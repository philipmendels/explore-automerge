import {
  initSyncState,
  applyChanges,
  change,
  clone,
  from,
  generateSyncMessage,
  getLastLocalChange,
  BinarySyncMessage as SyncMessage,
  receiveSyncMessage,
  Backend,
  getAllChanges,
  decodeChange,
  BinaryChange as Change,
} from "automerge";

const { decodeSyncMessage } = Backend;

let docA = from({ counter: 0 });
let docB = clone(docA);

for (let i = 0; i < 5; i++) {
  docB = change(docB, (doc) => doc.counter++);
}

[docA] = applyChanges(docA, [getLastLocalChange(docB)!]);

const getHash = (change: Change) => decodeChange(change).hash;

console.log("docA hashes", getAllChanges(docA).map(getHash));
console.log("docB hashes", getAllChanges(docB).map(getHash));

const makeClient = (initialDoc: typeof docA) => {
  let doc = initialDoc;
  let syncState = initSyncState();

  const generateMessage = () => {
    const [nextSyncState, syncMessage] = generateSyncMessage(doc, syncState);
    syncState = nextSyncState;
    return syncMessage;
  };

  return {
    getDoc: () => doc,
    generateMessage,
    receiveMessage: (syncMessage: SyncMessage) => {
      [doc, syncState] = receiveSyncMessage(doc, syncState, syncMessage);
      return generateMessage();
    },
  };
};

const clientA = makeClient(docA);
const clientB = makeClient(docB);

const logMessage = (name: string, message: SyncMessage) => {
  const { changes, ...rest } = decodeSyncMessage(message);
  console.log(name, { changeHashes: changes.map(getHash), ...rest });
};

const sync = (
  iteration: number,
  messageForB: SyncMessage | null | undefined
): number => {
  console.log("");
  console.log("iteration", iteration);
  if (messageForB) {
    logMessage("messageForB", messageForB);
    const messageForA = clientB.receiveMessage(messageForB);
    if (messageForA) {
      logMessage("messageForA", messageForA);
      return sync(iteration + 1, clientA.receiveMessage(messageForA));
    }
  }
  return iteration;
};

const iterations = sync(0, clientA.generateMessage());

console.log("docA hashes", getAllChanges(clientA.getDoc()).map(getHash));

console.log(`sync done in ${iterations} iteration(s)`);
