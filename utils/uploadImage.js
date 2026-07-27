import imagekit from "../config/imagekit.js";

export const uploadImage = async (file) => {
  try {
    const response = await imagekit.upload({
      file: file.buffer,
      fileName: `${Date.now()}-${file.originalname}`,
      folder: "/menu-images",
    });

    return {
      success: true,
      url: response.url,
      fileId: response.fileId,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: error.message,
    };
  }
};