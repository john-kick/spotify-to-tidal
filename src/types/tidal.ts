export type TidalAPIError = {
  errors: [
    {
      detail: string;
      code: number;
    }
  ];
};

export interface TidalAPIGetResponse {
  data: any;
  links: { next: string | undefined };
}

export interface TidalAPITracks extends TidalAPIGetResponse {
  data: TidalAPITrackData[];
}

export type TidalTrack = {
  name?: string;
  id: string;
  isrc: string;
  addedAt: number; // Timestamp
};

export type TidalAPITrackData = {
  id: string;
  attributes: { isrc: string };
};

export interface TidalAPIGetUserTrackRelResponse extends TidalAPIGetResponse {
  data: any[];
}
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

export interface TidalAPIUserPlaylists extends TidalAPIGetResponse {
  data: TidalAPIUserPlaylistsData[];
}

export type TidalAPIUserPlaylistsData = {
  id: string;
  name: string;
};
