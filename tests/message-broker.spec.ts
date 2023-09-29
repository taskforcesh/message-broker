import { MessageBroker } from '../src/message-broker'; // Update the path accordingly
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { EventEmitter } from 'events';

describe('MessageBroker', () => {
  let broker: MessageBroker<any>;
  let sendMock: any;
  let mockEmitter: EventEmitter;

  beforeEach(() => {
    mockEmitter = new EventEmitter();
    sendMock = (msg: string | Buffer) => {
      // Simulate a response after sending a message
      setTimeout(() => {
        const parsedMessage = JSON.parse(msg.toString());
        mockEmitter.emit('response', parsedMessage);
      }, 100);
    };
    broker = new MessageBroker(sendMock);
    mockEmitter.on('response', (message) => {
      broker.processMessage(message);
    });
  });

  afterEach(() => {
    mockEmitter.removeAllListeners();
  });

  it('should send data', async () => {
    const dataToSend = { test: 'data' };
    const result = await broker.sendData(dataToSend);
    expect(result).to.deep.equal(dataToSend);
  });

  it('should reject with timeout error', async () => {
    broker = new MessageBroker(sendMock, { messageTimeout: 50 });
    try {
      await broker.sendData({ test: 'data' });
    } catch (err) {
      expect(err.message).to.equal('Timeout');
    }
  });

  it('should handle message correctly', (done) => {
    const testData = { test: 'data' };
    broker.on('0', (data) => {
      expect(data).to.deep.equal(testData);
      done();
    });
    broker.processMessage({ id: 0, data: testData });
  });

  it('should close and reject all pending messages', async () => {
    const promise1 = broker.sendData({ test: 'data1' });
    const promise2 = broker.sendData({ test: 'data2' });

    broker.close();

    try {
      await promise1;
    } catch (err) {
      expect(err.message).to.equal('Connection closed');
    }

    try {
      await promise2;
    } catch (err) {
      expect(err.message).to.equal('Connection closed');
    }
  });

  describe('MessageBroker - noack option', () => {

    let broker: MessageBroker<any>;
    let sendMock: any;
    let mockEmitter: EventEmitter;

    let currentTimeout: NodeJS.Timeout | null = null;

    beforeEach(() => {
      mockEmitter = new EventEmitter();
      sendMock = (msg: string | Buffer) => {
        // Simulate a response after sending a message
        currentTimeout = setTimeout(() => {
          const parsedMessage = JSON.parse(msg.toString());
          mockEmitter.emit('response', parsedMessage);
        }, 100);
      };
      broker = new MessageBroker(sendMock);
      mockEmitter.on('response', (message) => {
        broker.processMessage(message);
      });
    });

    afterEach(() => {
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }
      mockEmitter.removeAllListeners();
    });


    it('should resolve immediately with null when noack is true', async () => {
      const dataToSend = { test: 'noack-data' };
      const result = await broker.sendData(dataToSend, { noack: true });
      expect(result).to.be.null;
    });

    it('should not resolve immediately when noack is not provided or false', async () => {
      const dataToSend = { test: 'ack-data' };

      let resolvedData: any;
      broker.sendData(dataToSend).then(data => {
        resolvedData = data;
      });

      await new Promise(resolve => setTimeout(resolve, 50));  // Waiting for half the mockEmitter's timeout
      expect(resolvedData).to.be.undefined;

      await new Promise(resolve => setTimeout(resolve, 100));  // Waiting for the mockEmitter's full timeout
      expect(resolvedData).to.deep.equal(dataToSend);
    });

  });

});
