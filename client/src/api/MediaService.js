import httpClient from "./httpClient";

/** Uploads a chat attachment. Resolves with `{ fileUrl, fileName, mimeType, size }`. */
export const uploadMessageMedia = async (file) => {
  const formData = new FormData();
  formData.append("media", file);
  const { data } = await httpClient.post("/uploads/uploadMedia", formData);
  return data;
};
