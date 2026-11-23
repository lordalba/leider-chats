import httpClient from "./httpClient";

/** The shared GIF library (defaults + everything users added), optionally filtered by title. */
export const fetchGifs = async (search = "") =>
  (await httpClient.get("/gifs", { params: search ? { search } : {} })).data;

/** Adds a GIF to the library for everyone. Resolves with the new GIF. */
export const addGif = async (file, title = "") => {
  const formData = new FormData();
  formData.append("gif", file);
  if (title) formData.append("title", title);
  return (await httpClient.post("/gifs", formData)).data;
};

/** Removes a GIF the current user added. */
export const removeGif = (gifId) => httpClient.delete(`/gifs/${gifId}`);
