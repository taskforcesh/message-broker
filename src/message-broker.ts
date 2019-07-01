import { EventEmitter } from "events";
const uuidv4 = require("uuid/v4");

export interface Message<T> {
  id: string;
  data: T;
}

export class MessageBroker<T> extends EventEmitter {
  private pendingMessages: {
    [index: string]: {
      resolve: (data: any) => void;
      reject: (err: Error) => void;
    };
  } = {};

  constructor(
    private send: (msg: string) => Promise<void>,
    private opts = {
      messageTimeout: 15000
    }
  ) {
    super();
  }

  processMessage({ id, data }: Message<T>) {
    delete this.pendingMessages[id];
    this.emit(id, data);
  }

  sendData<K>(data: T): Promise<K> {
    return new Promise((resolve, reject) => {
      var msg = {
        id: uuidv4(),
        data
      };
      this.send(JSON.stringify(msg));

      this.pendingMessages[msg.id] = {
        resolve,
        reject
      };

      const responseHandler = (data: K) => {
        delete this.pendingMessages[msg.id];
        resolve(data);
      };

      this.once(msg.id, responseHandler);

      setTimeout(() => {
        delete this.pendingMessages[msg.id];
        this.removeListener(msg.id, responseHandler);
        reject(new Error("Timeout"));
      }, this.opts.messageTimeout);
    });
  }

  close() {
    for (const key in this.pendingMessages) {
      this.pendingMessages[key].reject(new Error("Connection closed"));
    }
    this.pendingMessages = {};
  }
}
