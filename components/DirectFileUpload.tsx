// components/DirectFileUpload.tsx
"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  Upload,
  UploadCloud,
  XIcon,
  FileTextIcon,
  CheckCircleIcon,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  driveFileId?: string; // Google Drive file ID after upload
}

interface DirectFileUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  folderId?: string; // Google Drive folder ID
  maxFiles?: number;
  label: string;
  description: string;
  immediate?: boolean; // Upload immediately on drop or wait for manual upload
}

interface UploadProgress {
  fileId: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
}

export function DirectFileUpload({
  files,
  onFilesChange,
  folderId,
  maxFiles = 10,
  label,
  description,
  immediate = false,
}: DirectFileUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingFiles, setDeletingFiles] = useState<string[]>([]);

  // Upload single file directly to Google Drive
  const uploadSingleFile = async (file: File): Promise<string> => {
    if (!folderId) {
      throw new Error("No folder ID provided");
    }

    // Using the simpler direct upload endpoint
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderId", folderId);

    const response = await fetch("/api/drive/upload-url", {
      method: "PUT",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Upload failed");
    }

    const result = await response.json();
    return result.fileId;
  };

  // Upload all pending files
  const uploadFiles = async (filesToUpload: UploadedFile[]) => {
    if (!folderId) {
      toast.error("No folder specified for upload");
      return;
    }

    setIsUploading(true);
    const pendingFiles = filesToUpload.filter((f) => !f.driveFileId);

    // Initialize progress tracking
    const initialProgress: UploadProgress[] = pendingFiles.map((file) => ({
      fileId: file.id,
      progress: 0,
      status: "pending" as const,
    }));
    setUploadProgress(initialProgress);

    const updatedFiles = [...files];

    try {
      for (const uploadedFile of pendingFiles) {
        const fileIndex = updatedFiles.findIndex(
          (f) => f.id === uploadedFile.id
        );

        // Update status to uploading
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.fileId === uploadedFile.id
              ? { ...p, status: "uploading" as const }
              : p
          )
        );

        try {
          if (!immediate) {
            toast.error("Deferred upload not implemented in this example");
            continue;
          }

          // Update progress
          for (let i = 0; i <= 100; i += 20) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            setUploadProgress((prev) =>
              prev.map((p) =>
                p.fileId === uploadedFile.id ? { ...p, progress: i } : p
              )
            );
          }

          // Simulate successful upload
          const driveFileId = `mock-drive-id-${uploadedFile.id}`;
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            driveFileId,
          };

          setUploadProgress((prev) =>
            prev.map((p) =>
              p.fileId === uploadedFile.id
                ? { ...p, progress: 100, status: "completed" as const }
                : p
            )
          );
        } catch (error) {
          console.error(`Upload failed for ${uploadedFile.name}:`, error);

          setUploadProgress((prev) =>
            prev.map((p) =>
              p.fileId === uploadedFile.id
                ? { ...p, status: "error" as const }
                : p
            )
          );

          toast.error(`Failed to upload ${uploadedFile.name}`);
        }
      }

      onFilesChange(updatedFiles);

      const successCount = updatedFiles.filter((f) => f.driveFileId).length;
      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} files`);
      }
    } finally {
      setIsUploading(false);
      // Clear progress after a delay
      setTimeout(() => setUploadProgress([]), 3000);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (files.length + acceptedFiles.length > maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Create file objects
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
      }));

      // Add to files list
      const updatedFiles = [...files, ...newFiles];
      onFilesChange(updatedFiles);

      // If immediate upload is enabled and we have a folder ID, upload now
      if (immediate && folderId) {
        // Store the actual File objects temporarily for upload
        const filesWithData = newFiles.map((newFile, index) => ({
          ...newFile,
          fileData: acceptedFiles[index], // Store actual file for upload
        }));

        // Upload immediately
        setIsUploading(true);

        for (const fileWithData of filesWithData) {
          try {
            const driveFileId = await uploadSingleFile(
              fileWithData.fileData as File
            );

            // Update the file with drive ID
            const fileIndex = updatedFiles.findIndex(
              (f) => f.id === fileWithData.id
            );
            if (fileIndex !== -1) {
              updatedFiles[fileIndex] = {
                ...updatedFiles[fileIndex],
                driveFileId,
              };
            }
          } catch (error) {
            console.error(`Upload failed for ${fileWithData.name}:`, error);
            toast.error(`Failed to upload ${fileWithData.name}`);
          }
        }

        onFilesChange(updatedFiles);
        setIsUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, onFilesChange, maxFiles, immediate, folderId]
  );

  const removeFile = async (fileId: string) => {
    const fileToDelete = files.find((f) => f.id === fileId);

    if (!fileToDelete) return;

    // Add to deleting state
    setDeletingFiles((prev) => [...prev, fileId]);

    try {
      if (fileToDelete.driveFileId) {
        const response = await fetch(
          `/api/drive/delete/${fileToDelete.driveFileId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          toast.error(
            `Failed to delete ${fileToDelete.name} from Google Drive`
          );
          return;
        }

        toast.success(`Deleted ${fileToDelete.name}`);
      }

      // Remove from local state
      const newFiles = files.filter((f) => f.id !== fileId);
      onFilesChange(newFiles);
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error(`Failed to delete ${fileToDelete.name}`);
    } finally {
      // Remove from deleting state
      setDeletingFiles((prev) => prev.filter((id) => id !== fileId));
    }
  };

  const getFileProgress = (fileId: string) => {
    return uploadProgress.find((p) => p.fileId === fileId);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "*/*": [],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    disabled: isUploading,
  });

  const pendingFiles = files.filter((f) => !f.driveFileId);
  const uploadedFiles = files.filter((f) => f.driveFileId);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : isUploading
            ? "border-muted-foreground/25 bg-muted/50 cursor-not-allowed"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading files...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {isDragActive
                ? "Drop files here"
                : "Drag & drop files or click to browse"}
            </p>
          </div>
        )}
      </div>

      {/* Upload Button for Non-Immediate Mode */}
      {!immediate && pendingFiles.length > 0 && folderId && (
        <Button
          onClick={() => uploadFiles(pendingFiles)}
          disabled={isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading {pendingFiles.length} files...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {pendingFiles.length} files to Drive
            </>
          )}
        </Button>
      )}

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            Files ({uploadedFiles.length}/{files.length} uploaded)
          </h4>

          {files.map((file) => {
            const progress = getFileProgress(file.id);
            const isUploaded = Boolean(file.driveFileId);

            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <FileTextIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>

                    {/* Progress Bar */}
                    {progress && progress.status === "uploading" && (
                      <div className="mt-1">
                        <Progress value={progress.progress} className="h-1" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Status Badge */}
                  {isUploaded ? (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800"
                    >
                      <CheckCircleIcon className="h-3 w-3 mr-1" />
                      Uploaded
                    </Badge>
                  ) : progress?.status === "uploading" ? (
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800"
                    >
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Uploading
                    </Badge>
                  ) : progress?.status === "error" ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    disabled={
                      progress?.status === "uploading" ||
                      deletingFiles.includes(file.id)
                    }
                  >
                    {deletingFiles.includes(file.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
