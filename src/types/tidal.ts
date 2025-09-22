export type TidalAPIError = {
  errors: [
    {
      detail: string;
      code: number;
    }
  ];
};

export type TidalAPIGetTracksResponse = {
  data: { id: string }[];
};

export type TidalAPIGetUserTrackRelResponse = {
  data: any[];
  links: { next: string };
};
export type TidalAPIPostUserTrackRelResponse = any;

export type TidalAPIGetCurrentUserResponse = {
  data: {
    id: string;
  };
};

export type TidalAPIPostPlaylistResponse = {
  data: {
    id: string;
  };
};
