// export interface ItemContent {
//   references: any[];
//   conflict_of?: string;
//   protected?: boolean;
//   trashed?: boolean;
//   pinned?: boolean;
//   archived?: boolean;
//   starred?: boolean;
//   locked?: boolean;
//   appData?: any;
// }
//
// export interface TransferPayload<C extends ItemContent = ItemContent> {
//   uuid: string;
//   content_type: string;
//   content: C | string | undefined;
//   deleted?: boolean;
//
//   updated_at: Date;
//   created_at: Date;
//   created_at_timestamp: number;
//   updated_at_timestamp: number;
//
//   dirtyIndex?: number;
//   globalDirtyIndexAtLastSync?: number;
//   dirty?: boolean;
//   signatureData?: any;
//
//   lastSyncBegan?: Date;
//   lastSyncEnd?: Date;
//
//   duplicate_of?: string;
//   user_uuid?: string;
//
//   key_system_identifier?: string | undefined;
//   shared_vault_uuid?: string | undefined;
//
//   last_edited_by_uuid?: string;
// }
//
// export interface DecryptedTransferPayload<C extends ItemContent = ItemContent> extends TransferPayload {
//   content: C;
// }
//
// export type IncomingComponentItemPayload = DecryptedTransferPayload & {
//   clientData: Record<string, unknown>
// }
//
// export type OutgoingItemMessagePayload<C extends ItemContent = ItemContent> = {
//   uuid: string
//   content_type: string
//   created_at: Date
//   updated_at: Date
//   deleted?: boolean
//   content?: C
//   clientData?: Record<string, unknown>
//
//   /**
//    * isMetadataUpdate implies that the extension should make reference of updated
//    * metadata, but not update content values as they may be stale relative to what the
//    * extension currently has.
//    */
//   isMetadataUpdate: boolean
// }
//
// export type MessageData = Partial<{
//   /** Related to the stream-item-context action */
//   item?: IncomingComponentItemPayload
//   /** Related to the stream-items action */
//   content_types?: string[]
//   items?: IncomingComponentItemPayload[]
//   /** Related to the request-permission action */
//   permissions?: any[]
//   /** Related to the component-registered action */
//   componentData?: Record<string, unknown>
//   uuid?: string
//   environment?: string
//   platform?: string
//   activeThemeUrls?: string[]
//   /** Related to set-size action */
//   width?: string | number
//   height?: string | number
//   type?: string
//   /** Related to themes action */
//   themes?: string[]
//   /** Related to clear-selection action */
//   content_type?: string
//   /** Related to key-pressed action */
//   keyboardModifier?: any
// }>

// export type SnNote = {
//   isMetadataUpdate: boolean;
//   uuid: string;
// }

export type MessageData = {
  item?: NoteContainer;
  [key: string]: any;
}

export enum ComponentAction {
  // SetSize = 'set-size',
  // StreamItems = 'stream-items',
  StreamContextItem = 'stream-context-item',
  SaveItems = 'save-items',
  // SelectItem = 'select-item',
  // AssociateItem = 'associate-item',
  // DeassociateItem = 'deassociate-item',
  // ClearSelection = 'clear-selection',
  // CreateItem = 'create-item',
  // CreateItems = 'create-items',
  // DeleteItems = 'delete-items',
  SetComponentData = 'set-component-data',
  // InstallLocalComponent = 'install-local-component',
  // ToggleActivateComponent = 'toggle-activate-component',
  // RequestPermissions = 'request-permissions',
  // PresentConflictResolution = 'present-conflict-resolution',
  // DuplicateItem = 'duplicate-item',
  ComponentRegistered = 'component-registered',
  ActivateThemes = 'themes',
  // Reply = 'reply',
  // SaveSuccess = 'save-success',
  // SaveError = 'save-error',
  ThemesActivated = 'themes-activated',
  // KeyDown = 'key-down',
  // KeyUp = 'key-up',
  // Click = 'click'
}

export type Component = {
  uuid?: string
  origin?: string
  data?: ComponentData
  sessionKey?: string
  environment?: string
  platform?: string
  isMobile?: boolean
  acceptsThemes: boolean
  activeThemes: string[]
}

export enum MessagePayloadApi {
  Component = 'component',
}

export type ComponentData = {
  [key: string]: any
}

export type MessagePayload = {
  action: ComponentAction
  data: MessageData
  componentData?: ComponentData
  messageId?: string;
  sessionKey?: string;
  api: MessagePayloadApi
  original?: MessagePayload
  callback?: (...params: any) => void
}

export type SnMediatorOptions = {
  /** Number of milliseconds to wait before saving. Best between 100 and 400ms. **/
  debounceSave?: number;
  // onNoteFetched?: (text: string, appData: any) => void;
  generatePreview?: (text: string) => string;
}

export type NoteContent = {
  text: string;
  title: string;
  editorIdentifier: string;
  appData: Record<string, any>;
  preview_plain: string;
  preview_html: string;
}

export type NoteContainer = {
  content_type: string
  content: NoteContent;
  uuid: string;
  created_at: string;
  updated_at: string;
  isMetadataUpdate: boolean;
}
