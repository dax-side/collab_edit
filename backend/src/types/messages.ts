import { Op } from '../crdt/types'; 

export interface JoinMessage {
  type: 'join';
  docId: string; 
  clientId: string; 
}

export interface OpMessage {
  type: 'op';
  docId: string;
  op: Op;
}

export interface CursorMessage {
  type: 'cursor';
  docId: string;
  position: number;
}

export type ClientMessage = JoinMessage | OpMessage | CursorMessage;


export interface InitMessage {
  type: 'init';
  docId: string;
  ops: Op[];
}

export interface ServerOpMessage {
  type: 'op';
  docId: string;
  op: Op; 
  clientId: string; 
}

export interface ServerCursorMessage {
  type: 'cursor';
  docId: string;
  clientId: string;
  position: number;
}

export interface PresenceMessage {
  type: 'presence';
  docId: string;
  clients: string[];
}

export interface ErrorMessage {
  type: 'error';
  message: string; 
}

export type ServerMessage =
  | InitMessage
  | ServerOpMessage
  | ServerCursorMessage
  | PresenceMessage
  | ErrorMessage;
