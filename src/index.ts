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
  private subscriptions = [];
  private generateNotePreview: boolean = true;

  public initialize(options: SnMediatorOptions = {}) {
    if (this.contentWindow) {
      throw 'Cannot initialize mediator more than once';
    }
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
    this.checkNoteExists();
    return this.lastStreamedItem?.content?.text || '';
  }

  public get meta(): any {
    this.checkNoteExists();
    if (this.lastStreamedItem?.content) {
      return this.lastStreamedItem.content.appData[this.lastStreamedItem.content.editorIdentifier];
    }
    return {};
  }

  public get extensionMeta(): any {
    return this.component.data;
  }

  public get locked(): boolean {
    this.checkNoteExists();
    return this.lastStreamedItem?.content?.appData[SN_DOMAIN]['locked'];
  }

  public get preview(): string {
    this.checkNoteExists();
    return this.lastStreamedItem?.content?.preview_plain;
  }

  public set text(newText: string) {
    this.checkNoteExists();
    this.lastStreamedItem.content.text = newText;
    this.saveNote(this.lastStreamedItem);
  };

  public set preview(newPreview: string) {
    this.checkNoteExists();
    this.generateNotePreview = false;
    this.lastStreamedItem.content.preview_plain = newPreview;
  }

  public set meta(newMeta: any) {
    this.checkNoteExists();
    this.lastStreamedItem.content.appData[this.lastStreamedItem.content.editorIdentifier] = newMeta;
    this.saveNote(this.lastStreamedItem);
  };

  public set extensionMeta(data: any) {
    this.component.data = data;
    this.postMessage(ComponentAction.SetComponentData, {
      componentData: data
    });
  }

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

  public get isRunningInDesktopApplication(): boolean {
    return this.component.environment === 'desktop';
  }

  public get isRunningInMobileApplication(): boolean {
    return this.component.environment === 'mobile';
  }

  public get isRunningInBrowser(): boolean {
    return this.component.environment === 'web';
  }

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
    if (this.isRunningInMobileApplication) {
      postMessagePayload = JSON.stringify(message);
    } else {
      postMessagePayload = message;
    }

    // Logger.info('Posting message:', postMessagePayload);
    this.contentWindow.parent.postMessage(
      postMessagePayload, '*'
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

  public get platform(): string | undefined {
    return this.component.platform;
  }

  public get environment(): string | undefined {
    return this.component.environment;
  }

  private performSavingOfItems({items, callback}: {
    items: NoteContainer[]
    callback?: () => void
  }) {
    if (this.generateNotePreview) {
      items[0].content.preview_plain = getPreviewText(items[0].content.text);
    }

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

  private checkNoteExists() {
    if (!this.lastStreamedItem) {
      throw 'Trying to interact with note before it is received from Standard Notes. Use subscribe function.';
    }
  }
}

export const snApi = new StandardNotesExtensionAPI();
export default snApi;
