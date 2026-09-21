"use client";

import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type DocumentUploadProps = {
  id: string;
  file: File | null;
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  error?: string;
};

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,application/pdf";

export function DocumentUpload({ id, file, onFiles, disabled = false, error }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = "";
  }, [file]);

  function useFiles(files: FileList) {
    if (!files.length || disabled) return;
    const transfer = new DataTransfer();
    transfer.items.add(files[0]);
    if (inputRef.current) inputRef.current.files = transfer.files;
    onFiles(transfer.files);
  }

  function clearFile() {
    const transfer = new DataTransfer();
    if (inputRef.current) inputRef.current.value = "";
    onFiles(transfer.files);
  }

  return <div className="document-upload">
    <input
      ref={inputRef}
      id={id}
      className="document-upload-input"
      type="file"
      accept={ACCEPTED_TYPES}
      required
      disabled={disabled}
      onChange={(event) => { if (event.target.files) useFiles(event.target.files); }}
    />
    <button
      type="button"
      className={`document-upload-dropzone ${isDragging ? "is-dragging" : ""} ${file ? "is-selected" : ""} ${error ? "has-error" : ""}`}
      disabled={disabled}
      aria-invalid={Boolean(error)}
      aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => { event.preventDefault(); if (disabled) return; dragDepth.current += 1; setIsDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) event.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setIsDragging(false); }}
      onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setIsDragging(false); useFiles(event.dataTransfer.files); }}
    >
      <span className="document-upload-icon" aria-hidden="true">
        {isDragging ? <UploadCloud size={25} /> : file ? <CheckCircle2 size={25} /> : <FileText size={25} />}
      </span>
      <span className="document-upload-copy">
        <strong>{isDragging ? "Release to attach document" : file ? file.name : "Drop your withdrawal confirmation here"}</strong>
        <span>{isDragging ? "The document will be attached to this earning." : file ? `${formatFileSize(file.size)} · Ready to submit` : "Drag and drop, or click to browse your device"}</span>
      </span>
      <span className="document-upload-action" aria-hidden="true">{file ? "Replace" : "Choose document"}</span>
      <span id={`${id}-hint`} className="document-upload-formats">PDF, PNG, JPG or WebP <b /> Maximum 10 MB</span>
    </button>
    {file && !disabled ? <button type="button" className="document-upload-remove" onClick={clearFile}><X size={13} aria-hidden="true" /> Remove document</button> : null}
    {error ? <p id={`${id}-error`} className="scouter-field-error" role="alert">{error}</p> : null}
  </div>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
