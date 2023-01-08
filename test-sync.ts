import {
  initSyncState,
  applyChanges,
  change,
  clone,
  from,
  generateSyncMessage,
  getLastLocalChange,
  SyncMessage,
  receiveSyncMessage,
  decodeSyncMessage,
  getAllChanges,
  decodeChange,
  Change,
} from "@automerge/automerge";

// Start with two docs with the same initial change:
let docA = from({ counter: 0 });
let docB = clone(docA);

// Create some changes in the second doc:
for (let i = 0; i < 5; i++) {
  docB = change(docB, (doc) => doc.counter++);
}

// Apply the last change of the second doc to the first doc,
// so that the first doc has a 'gap' (missing in-between changes).
// These missing changes seem to be synced one-by-one.
[docA] = applyChanges(docA, [getLastLocalChange(docB)!]);

// Optionally create more changes in the second doc. Due to the gap
// above these changes seem to be synced one-by-one as well starting
// from the end, therefore possibly creating a new gap.
//
// for (let i = 0; i < 10; i++) {
//   docB = change(docB, (doc) => doc.counter++);
// }

const getHash = (change: Change) => decodeChange(change).hash;

console.log("docB hashes", getAllChanges(docB).map(getHash));

const makeClient = (doc: typeof docA) => {
  let syncState = initSyncState();

  const generateMessage = () => {
    const [nextSyncState, syncMessage] = generateSyncMessage(doc, syncState);
    syncState = nextSyncState;
    return syncMessage;
  };

  return {
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

const sync = (iteration: number, messageForB: SyncMessage | null): number => {
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

console.log("docA hashes", getAllChanges(docA).map(getHash));

console.log(`sync done in ${iterations} iteration(s)`);
