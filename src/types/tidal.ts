export type TidalAPIError = {
  errors: [
    {
      detail: string;
      code: number;
    }
  ];
};

export type TidalAPITracks = {
  data: TidalAPITrackData[];
};

export type TidalAPITrackData = {
  id: string;
  attributes: { isrc: string };
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

export type TidalAPIUserPlaylists = {
  data: TidalAPIUserPlaylistsData[];
  links: {
    next: string;
  };
};

export type TidalAPIUserPlaylistsData = {
  id: string;
  name: string;
};
