const dialogflow = require("@google-cloud/dialogflow");
const path = require("path");

const keyPath = path.join(__dirname, "../config/dialogflowKey.json");

const sessionClient = new dialogflow.SessionsClient({
  keyFilename: keyPath,
});

const projectId = require(keyPath).project_id;

async function sendToDialogflow(text, sessionId) {
  const sessionPath = sessionClient.projectAgentSessionPath(
    projectId,
    sessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: { text, languageCode: "vi" },
    },
  };

  const responses = await sessionClient.detectIntent(request);
  return responses[0].queryResult.fulfillmentText;
}

module.exports = { sendToDialogflow };
