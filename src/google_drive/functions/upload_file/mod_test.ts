import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "../../../shared/testing/test_google_key.ts";
import { UploadFileToGoogleDriveFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(UploadFileToGoogleDriveFunction);

async function testEnv() {
  return {
    ...(await createTestGoogleServiceAccountEnv()),
    SLACK_BOT_TOKEN: "xoxb-test",
  };
}

Deno.test("uploads a file from a public URL and guesses its mime type", async () => {
  const env = await testEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "example.com/report.pdf": "%PDF-fake-bytes%",
      "www.googleapis.com/upload/drive/v3/files": {
        id: "FILE1",
        webViewLink: "https://drive.google.com/file/d/FILE1",
      },
    },
  });

  try {
    const result = await handler(createContext({
      inputs: {
        fileURL: "https://example.com/report.pdf",
        fileName: "Bericht.pdf",
        driveFolderID: "FOLDER1",
      },
      env,
    }));

    assertEquals(result.outputs, {
      driveFileId: "FILE1",
      driveFileURL: "https://drive.google.com/file/d/FILE1",
    });

    const uploadCall = stub.calls.find((call) =>
      call.url.includes("upload/drive/v3/files")
    );
    assertEquals(
      uploadCall?.url.includes("multipart"),
      true,
    );
  } finally {
    stub.restore();
  }
});

Deno.test("prefixes the file name with fileDate when given", async () => {
  const env = await testEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "example.com/report.pdf": "bytes",
      "www.googleapis.com/upload/drive/v3/files": {
        id: "FILE1",
        webViewLink: "https://drive.google.com/file/d/FILE1",
      },
    },
  });

  try {
    await handler(createContext({
      inputs: {
        fileURL: "https://example.com/report.pdf",
        fileName: "Bericht.pdf",
        fileDate: "2026-07-28",
        driveFolderID: "FOLDER1",
      },
      env,
    }));

    const uploadCall = stub.calls.find((call) =>
      call.url.includes("upload/drive/v3/files")
    );
    const bodyText = await new Response(uploadCall?.rawBody).text();
    assertEquals(bodyText.includes(`"name":"20260728 Bericht.pdf"`), true);
  } finally {
    stub.restore();
  }
});

Deno.test("downloads a Slack file with the bot token and appends its real extension", async () => {
  const env = await testEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "files.info": {
        ok: true,
        file: {
          name: "original.png",
          mimetype: "image/png",
          url_private_download: "https://files.slack.com/priv/original.png",
        },
      },
      "files.slack.com/priv/original.png": "fake-png-bytes",
      "www.googleapis.com/upload/drive/v3/files": {
        id: "FILE2",
        webViewLink: "https://drive.google.com/file/d/FILE2",
      },
    },
  });

  try {
    const result = await handler(createContext({
      inputs: {
        file: "F123",
        fileName: "Foto",
        driveFolderID: "FOLDER1",
      },
      env,
    }));

    assertEquals(result.outputs?.driveFileId, "FILE2");

    const downloadCall = stub.calls.find((call) =>
      call.url.includes("files.slack.com")
    );
    assertEquals(downloadCall !== undefined, true);
  } finally {
    stub.restore();
  }
});

Deno.test("returns an error when neither file nor fileURL is given", async () => {
  const env = await testEnv();

  const result = await handler(createContext({
    inputs: { fileName: "x", driveFolderID: "FOLDER1" },
    env,
  }));

  assertEquals(typeof result.error, "string");
});
