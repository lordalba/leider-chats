const API_URL = "http://localhost:3000/api/uploads";

export const uploadMessageMedia = async (formData) => {
  return await fetch(`${API_URL}/uploadMedia`, {
    method: "POST",
    body: formData,
  });
};
