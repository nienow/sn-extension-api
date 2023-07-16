import {Component, ComponentAction, MessageData, MessagePayload, MessagePayloadApi, NoteContainer, SnMediatorOptions} from './sn-types';
import {getPreviewText, isValidJsonString} from './utils';

const DEFAULT_COALLESED_SAVING_DELAY = 250;
const SN_DOMAIN = 'org.standardnotes.sn';

class StandardNotesExtensionAPI {
  private contentWindow: Window;
  private component: Component = {activeThemes: [], acceptsThemes: true};
  private sentMessages: MessagePayload[] = [];
  private messageQueue: MessagePayload[] = [];
  private lastStreamedItem?: NoteContainer;
  private pendingSaveItems?: NoteContainer[];
  private pendingSaveTimeout?: NodeJS.Timeout;
  private pendingSaveParams?: any;
  private coallesedSavingDelay;
  private messageHandler?: (event: any) => void;
  private onThemesChangeCallback?: () => void;
  private generatePreview: () => string;
  private subscriptions = [];

  public initialize(options: SnMediatorOptions) {
    if (this.contentWindow) {
      throw 'Cannot initialize mediator more than once';
    }
    options = options || {};
    this.contentWindow = window;
    this.coallesedSavingDelay = typeof options.debounceSave !== 'undefined' ? options.debounceSave : DEFAULT_COALLESED_SAVING_DELAY;
    this.registerMessageHandler();

    this.postMessage(ComponentAction.StreamContextItem, {}, (data) => {
      const {item} = data;
      const isNewItem =
        !this.lastStreamedItem || this.lastStreamedItem.uuid !== item.uuid;

      if (isNewItem && this.pendingSaveTimeout) {
        clearTimeout(this.pendingSaveTimeout);
        this.performSavingOfItems(this.pendingSaveParams);
        this.pendingSaveTimeout = undefined;
        this.pendingSaveParams = undefined;
      }

      this.lastStreamedItem = item;
      if (!this.lastStreamedItem.isMetadataUpdate) {
        this.subscriptions.forEach((sub) => {
          sub(this.text, this.meta);
        });
      }
    });
  }

  public subscribe(callback: (note: string, meta: any) => void): () => void {
    this.subscriptions.push(callback);
    if (this.lastStreamedItem) {
      setTimeout(() => {
        callback(this.text, this.meta);
      });
    }
    return () => {
      const index = this.subscriptions.indexOf(callback);
      if (index >= 0) {
        this.subscriptions.splice(index, 1);
      }
    };
  };

  public get text(): string {
    return this.lastStreamedItem?.content?.text || '';
  }

  public get meta(): any {
    if (this.lastStreamedItem?.content) {
      return this.lastStreamedItem.content.appData[this.lastStreamedItem.content.editorIdentifier];
    }
    return {};
  }

  public get locked(): boolean {
    return this.lastStreamedItem?.content?.appData[SN_DOMAIN]['locked'];
  }

  public get archived(): boolean {
    return this.lastStreamedItem?.content?.appData[SN_DOMAIN]['archived'];
  }

  public get pinned(): boolean {
    return this.lastStreamedItem?.content?.appData[SN_DOMAIN]['pinned'];
  }

  public get trashed(): boolean {
    return this.lastStreamedItem?.content?.appData[SN_DOMAIN]['trashed'];
  }

  public get starred(): boolean {
    return this.lastStreamedItem?.content?.appData[SN_DOMAIN]['starred'];
  }

  public updateNote(newText: string, generatePreview?: () => string) {
    this.lastStreamedItem.content.text = newText;
    this.generatePreview = generatePreview || this.generatePreview;
    this.saveNote(this.lastStreamedItem);
  };

  public updateMeta(newMeta: any) {
    this.lastStreamedItem.content.appData[this.lastStreamedItem.content.editorIdentifier] = newMeta;
    this.saveNote(this.lastStreamedItem);
  };

  private registerMessageHandler() {
    this.messageHandler = (event: MessageEvent) => {
      if (document.referrer) {
        const referrer = new URL(document.referrer).origin;
        const eventOrigin = new URL(event.origin).origin;

        if (referrer !== eventOrigin) {
          return;
        }
      }

      // Mobile environment sends data as JSON string.
      const {data} = event;
      const parsedData = isValidJsonString(data) ? JSON.parse(data) : data;

      if (!parsedData) {
        // Logger.error('Invalid data received. Skipping...');
        return;
      }

      /**
       * The Component Registered message will be the most reliable one, so we won't change it after any subsequent events,
       * in case you receive an event from another window.
       */
      if (
        typeof this.component.origin === 'undefined' &&
        parsedData.action === ComponentAction.ComponentRegistered
      ) {
        this.component.origin = event.origin;
      } else if (event.origin !== this.component.origin) {
        // If event origin doesn't match first-run value, return.
        return;
      }

      this.handleMessage(parsedData);
    };

    this.contentWindow.document.addEventListener(
      'message',
      this.messageHandler,
      false,
    );
    this.contentWindow.addEventListener('message', this.messageHandler, false);
  }

  private handleMessage(payload: MessagePayload) {
    switch (payload.action) {
      case ComponentAction.ComponentRegistered:
        this.component.sessionKey = payload.sessionKey;
        if (payload.componentData) {
          this.component.data = payload.componentData;
        }
        this.onReady(payload.data);
        break;

      case ComponentAction.ActivateThemes:
        this.activateThemes(payload.data.themes);
        break;

      default: {
        if (!payload.original) {
          return;
        }

        // Get the callback from queue.
        const originalMessage = this.sentMessages?.filter(
          (message: MessagePayload) => {
            return message.messageId === payload.original?.messageId;
          },
        )[0];

        if (!originalMessage) {
          return;
        }

        originalMessage?.callback?.(payload.data);
        break;
      }
    }
  }

  private onReady(data: any) {
    this.component.environment = data.environment;
    this.component.platform = data.platform;
    this.component.uuid = data.uuid;

    for (const message of this.messageQueue) {
      this.postMessage(message.action, message.data, message.callback);
    }

    this.messageQueue = [];

    this.activateThemes(data.activeThemeUrls || []);
    this.postMessage(ComponentAction.ThemesActivated, {});
  }

  public isRunningInDesktopApplication(): boolean {
    return this.component.environment === 'desktop';
  }

  public isRunningInMobileApplication(): boolean {
    return this.component.environment === 'native-mobile-web';
  }

  public isRunningInBrowser(): boolean {
    return this.component.environment === 'web';
  }

  /**
   * Gets the component's data value for the specified key.
   * @param key The key for the data object.
   * @returns `undefined` if the value for the key does not exist. Returns the stored value otherwise.
   */
  // public getComponentDataValueForKey(key: string): any {
  //   if (!this.component.data) {
  //     return;
  //   }
  //   return this.component.data[key];
  // }

  /**
   * Sets the component's data value for the specified key.
   * @param key The key for the data object.
   * @param value The value to store under the specified key.
   */
  // public setComponentDataValueForKey(key: string, value: any): void {
  //   if (!this.component.data) {
  //     throw new Error('The component has not been initialized.');
  //   }
  //   if (!key || (key && key.length === 0)) {
  //     throw new Error('The key for the data value should be a valid string.');
  //   }
  //   this.component.data = {
  //     ...this.component.data,
  //     [key]: value,
  //   };
  //   this.postMessage(ComponentAction.SetComponentData, {
  //     componentData: this.component.data,
  //   });
  // }

  /**
   * Clears the component's data object.
   */
  // public clearComponentData(): void {
  //   this.component.data = {};
  //   this.postMessage(ComponentAction.SetComponentData, {
  //     componentData: this.component.data,
  //   });
  // }

  private postMessage(
    action: ComponentAction,
    data: MessageData,
    callback?: (...params: any) => void,
  ) {
    /**
     * If the sessionKey is not set, we push the message to queue
     * that will be processed later on.
     */
    if (!this.component.sessionKey) {
      this.messageQueue.push({
        action,
        data,
        api: MessagePayloadApi.Component,
        callback: callback,
      });
      return;
    }

    const message = {
      action,
      data,
      messageId: this.generateUUID(),
      sessionKey: this.component.sessionKey,
      api: MessagePayloadApi.Component,
    };

    const sentMessage = JSON.parse(JSON.stringify(message));
    sentMessage.callback = callback;
    this.sentMessages.push(sentMessage);

    let postMessagePayload;

    // Mobile (React Native) requires a string for the postMessage API.
    if (this.isRunningInMobileApplication()) {
      postMessagePayload = JSON.stringify(message);
    } else {
      postMessagePayload = message;
    }

    // Logger.info('Posting message:', postMessagePayload);
    this.contentWindow.parent.postMessage(
      postMessagePayload,
      this.component.origin!,
    );
  }

  private activateThemes(incomingUrls: string[] = []) {
    if (!this.component.acceptsThemes) {
      return;
    }
    const {activeThemes} = this.component;

    if (
      activeThemes &&
      activeThemes.sort().toString() == incomingUrls.sort().toString()
    ) {
      return;
    }

    let themesToActivate = incomingUrls;
    const themesToDeactivate = [];

    for (const activeUrl of activeThemes) {
      if (!incomingUrls.includes(activeUrl)) {
        // Active not present in incoming, deactivate it.
        themesToDeactivate.push(activeUrl);
      } else {
        // Already present in active themes, remove it from themesToActivate.
        themesToActivate = themesToActivate.filter((candidate) => {
          return candidate !== activeUrl;
        });
      }
    }

    for (const themeUrl of themesToDeactivate) {
      this.deactivateTheme(themeUrl);
    }

    this.component.activeThemes = incomingUrls;

    for (const themeUrl of themesToActivate) {
      if (!themeUrl) {
        continue;
      }

      const link = this.contentWindow.document.createElement('link');
      link.id = btoa(themeUrl);
      link.href = themeUrl;
      link.type = 'text/css';
      link.rel = 'stylesheet';
      link.media = 'screen,print';
      link.className = 'custom-theme';
      this.contentWindow.document
        .getElementsByTagName('head')[0]
        .appendChild(link);
    }

    this.onThemesChangeCallback && this.onThemesChangeCallback();
  }

  private themeElementForUrl(themeUrl: string) {
    const elements = Array.from(
      this.contentWindow.document.getElementsByClassName('custom-theme'),
    ).slice();
    return elements.find((element) => {
      // We used to search here by `href`, but on desktop, with local file:// urls, that didn't work for some reason.
      return element.id == btoa(themeUrl);
    });
  }

  private deactivateTheme(themeUrl: string) {
    const element = this.themeElementForUrl(themeUrl);
    if (element && element.parentNode) {
      element.setAttribute('disabled', 'true');
      element.parentNode.removeChild(element);
    }
  }

  private generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Gets the current platform where the component is running.
   */
  public get platform(): string | undefined {
    return this.component.platform;
  }

  /**
   * Gets the current environment where the component is running.
   */
  public get environment(): string | undefined {
    return this.component.environment;
  }

  private performSavingOfItems({items, callback}: {
    items: NoteContainer[]
    callback?: () => void
  }) {
    items[0].content.preview_plain = this.generatePreview ? this.generatePreview() : getPreviewText(items[0].content.text);

    const mappedItems = [];
    for (const item of items) {
      mappedItems.push(this.jsonObjectForItem(item));
    }

    this.postMessage(
      ComponentAction.SaveItems,
      {items: mappedItems},
      () => {
        callback?.();
      },
    );
  }

  /**
   * Saves a collection of existing Items.
   * @param item The items to be saved.
   * @param callback
   * @param skipDebouncer Allows saves to go through right away rather than waiting for timeout.
   * This should be used when saving items via other means besides keystrokes.
   * @param presave
   */
  private saveNote(
    item: NoteContainer,
    callback?: () => void,
  ): void {
    const items = [item];
    if (!this.pendingSaveItems) {
      this.pendingSaveItems = [];
    }

    if (this.coallesedSavingDelay) {
      if (this.pendingSaveTimeout) {
        clearTimeout(this.pendingSaveTimeout);
      }

      const incomingIds = items.map((item) => item.uuid);

      const preexistingItems = this.pendingSaveItems.filter((item) => {
        return !incomingIds.includes(item.uuid);
      });

      this.pendingSaveItems = preexistingItems.concat(items);

      this.pendingSaveParams = {
        items: this.pendingSaveItems,
        callback,
      };

      this.pendingSaveTimeout = setTimeout(() => {
        this.performSavingOfItems(this.pendingSaveParams);
        this.pendingSaveItems = [];
        this.pendingSaveTimeout = undefined;
        this.pendingSaveParams = null;
      }, this.coallesedSavingDelay);
    } else {
      this.performSavingOfItems({items, callback});
    }
  }

  private jsonObjectForItem(item: MessageData) {
    const copy = Object.assign({}, item) as any;
    copy.children = null;
    copy.parent = null;
    return copy;
  }
}

const snApi = new StandardNotesExtensionAPI();
export default snApi;
