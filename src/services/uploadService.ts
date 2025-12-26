import httpClient from '../api/httpClient';

type AuthenticatedRequest = {
  accessToken: string;
};

export type UploadImageResponse = {
  url: string;
  publicId?: string;
  fileName?: string;
  fileSize?: number;
};

export type UploadVideoResponse = {
  url: string;
  publicId?: string;
};

/**
 * Upload image to Cloudinary
 * Endpoint: POST /api/v1/uploads/images (Primary) hoặc POST /api/uploads/images (Fallback)
 */
export const uploadImage = async ({
  accessToken,
  file,
}: AuthenticatedRequest & {
  file: {
    uri: string;
    type: string;
    name?: string;
  };
}): Promise<UploadImageResponse> => {
  // Create FormData
  const formData = new FormData();
  
  // Append file to FormData
  // React Native FormData format
  formData.append('files', {
    uri: file.uri,
    type: file.type || 'image/jpeg',
    name: file.name || 'image.jpg',
  } as any);

  try {
    // Try primary endpoint first
    const { data } = await httpClient.post<UploadImageResponse[]>(
      '/v1/uploads/images',
      formData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          // Don't set Content-Type, let axios set it with boundary for multipart/form-data
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    // Response is array, get first item
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    
    // If response is not array, assume it's the object itself
    return data as any;
  } catch (error: any) {
    // If primary endpoint fails, try fallback
    if (error.response?.status === 404 || error.response?.status === 500) {
      try {
        const { data } = await httpClient.post<UploadImageResponse[]>(
          '/uploads/images',
          formData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'multipart/form-data',
            },
          },
        );

        if (Array.isArray(data) && data.length > 0) {
          return data[0];
        }
        
        return data as any;
      } catch (fallbackError: any) {
        throw {
          status: fallbackError.response?.status || 0,
          message:
            fallbackError.response?.data?.message ||
            fallbackError.message ||
            'Không thể upload ảnh. Vui lòng thử lại.',
          response: fallbackError.response,
        };
      }
    }

    // Re-throw with formatted error
    throw {
      status: error.response?.status || 0,
      message:
        error.response?.data?.message ||
        error.message ||
        'Không thể upload ảnh. Vui lòng thử lại.',
      response: error.response,
    };
  }
};

/**
 * Upload video to Cloudinary
 * Endpoint: POST /api/v1/uploads/video
 */
export const uploadVideo = async ({
  accessToken,
  file,
}: AuthenticatedRequest & {
  file: {
    uri: string;
    type: string;
    name?: string;
  };
}): Promise<UploadVideoResponse> => {
  const formData = new FormData();
  
  formData.append('file', {
    uri: file.uri,
    type: file.type || 'video/mp4',
    name: file.name || 'video.mp4',
  } as any);

  try {
    const { data } = await httpClient.post<UploadVideoResponse>(
      '/v1/uploads/video',
      formData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    return data;
  } catch (error: any) {
    throw {
      status: error.response?.status || 0,
      message:
        error.response?.data?.message ||
        error.message ||
        'Không thể upload video. Vui lòng thử lại.',
      response: error.response,
    };
  }
};
