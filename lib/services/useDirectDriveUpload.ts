// hooks/useDirectDriveUpload.ts
import { useState } from "react";
import { toast } from "sonner";

interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: "uploading" | "completed" | "error";
}

interface DirectUploadConfig {
  folderId: string;
  accessToken: string;
}

export const useDirectDriveUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Get upload URL from your backend
  const getUploadUrl = async (
    fileName: string,
    mimeType: string,
    folderId: string
  ) => {
    const response = await fetch("/api/drive/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, mimeType, folderId }),
    });

    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }

    return response.json();
  };

  // Direct upload to Google Drive using resumable upload
  const uploadFile = async (
    file: File,
    config: DirectUploadConfig,
    onProgress?: (progress: number) => void
  ): Promise<string> => {
    try {
      // Step 1: Get upload URL from your backend
      const { uploadUrl } = await getUploadUrl(
        file.name,
        file.type,
        config.folderId
      );

      // Step 2: Upload directly to Google Drive
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            onProgress?.(progress);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status === 200 || xhr.status === 201) {
            const response = JSON.parse(xhr.responseText);
            resolve(response.id);
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed"));
        });

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  // Upload multiple files
  const uploadFiles = async (
    files: File[],
    config: DirectUploadConfig
  ): Promise<string[]> => {
    if (files.length === 0) return [];

    setIsUploading(true);
    const fileIds: string[] = [];

    try {
      // Initialize progress tracking
      const initialProgress: UploadProgress[] = files.map((file, index) => ({
        fileId: `temp-${index}`,
        fileName: file.name,
        progress: 0,
        status: "uploading" as const,
      }));
      setUploadProgress(initialProgress);

      // Upload files sequentially to avoid overwhelming the API
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
          const fileId = await uploadFile(file, config, (progress) => {
            setUploadProgress((prev) =>
              prev.map((item, index) =>
                index === i
                  ? { ...item, progress, status: "uploading" as const }
                  : item
              )
            );
          });

          fileIds.push(fileId);

          // Mark as completed
          setUploadProgress((prev) =>
            prev.map((item, index) =>
              index === i
                ? {
                    ...item,
                    fileId,
                    progress: 100,
                    status: "completed" as const,
                  }
                : item
            )
          );
        } catch (error) {
          // Mark as error
          setUploadProgress((prev) =>
            prev.map((item, index) =>
              index === i ? { ...item, status: "error" as const } : item
            )
          );

          toast.error(`Failed to upload ${file.name}`);
          throw error;
        }
      }

      toast.success(`Successfully uploaded ${files.length} files`);
      return fileIds;
    } finally {
      setIsUploading(false);
    }
  };

  const clearProgress = () => {
    setUploadProgress([]);
  };

  return {
    uploadFiles,
    uploadProgress,
    isUploading,
    clearProgress,
  };
};
