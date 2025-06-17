import { google } from "googleapis";
import { Readable } from "stream";

export class GoogleDriveService {
  private drive;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(serviceAccountKey: any) {
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    this.drive = google.drive({ version: "v3", auth });
  }

  /**
   * Create task folder structure
   */
  async createTaskFolder(
    taskId: string,
    parentFolderId: string
  ): Promise<{
    taskFolderId: string;
    taskFolderUrl: string;
    requestFolderId: string;
    responseFolderId: string;
  }> {
    try {
      // Create main task folder
      const taskFolder = await this.drive.files.create({
        requestBody: {
          name: taskId,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        },
      });

      const taskFolderId = taskFolder.data.id!;

      // Create request subfolder
      const requestFolder = await this.drive.files.create({
        requestBody: {
          name: "request",
          mimeType: "application/vnd.google-apps.folder",
          parents: [taskFolderId],
        },
      });

      // Create response subfolder
      const responseFolder = await this.drive.files.create({
        requestBody: {
          name: "response",
          mimeType: "application/vnd.google-apps.folder",
          parents: [taskFolderId],
        },
      });

      const taskFolderUrl = `https://drive.google.com/drive/folders/${taskFolderId}`;

      return {
        taskFolderId,
        taskFolderUrl,
        requestFolderId: requestFolder.data.id!,
        responseFolderId: responseFolder.data.id!,
      };
    } catch (error) {
      console.error("Error creating Google Drive folders:", error);
      throw new Error("Failed to create Google Drive folders");
    }
  }

  /**
   * Upload file to specific folder
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId: string
  ): Promise<string> {
    try {
      const fileStream = Readable.from(fileBuffer);

      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType: mimeType,
          body: fileStream,
        },
      });

      return response.data.id!;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error(`Failed to upload file: ${fileName}`);
    }
  }

  /**
   * set folder permissions for sharing
   */
  async setFolderPermissions(
    folderId: string,
    userEmail?: string
  ): Promise<void> {
    try {
      // Make folder viewable by anyone with the link
      await this.drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Give user edit access
      if (userEmail) {
        await this.drive.permissions.create({
          fileId: folderId,
          requestBody: {
            role: "writer",
            type: "user",
            emailAddress: userEmail,
          },
        });
      }
    } catch (error) {
      console.error("Error setting folder permissions:", error);
    }
  }
}
