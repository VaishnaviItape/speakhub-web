import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

export const uploadFile = async (file: File, folderPath: string): Promise<string> => {
  if (!file) throw new Error("No file provided");
  const storageRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
};
