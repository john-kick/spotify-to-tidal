export type SpotifyAPIError = {
  error: {
    status: number;
    message: string;
  };
};

export interface SpotifyAPIGetResponse {
  items: any[];
  next?: string;
}

export type SpotifyTrack = {
  id: string;
  title: string;
  // artist: string;
  isrc: string;
  addedAt: number; // timestamp
};

export type SpotifyPlaylist = {
  description: string;
  images: SpotifyImage[];
  name: string;
  public: boolean;
  tracks: SpotifyTrack[];
};

export type SpotifyImage = {
  url: string;
  height: number;
  width: number;
};

export interface SpotifyAPIUserTracks extends SpotifyAPIGetResponse {
  items: SpotifyAPIUserTrack[];
}

export type SpotifyAPIUserTrack = {
  track: {
    id: string;
    name: string;
    external_ids: { isrc: string };
  };
  added_at: string;
};

export type SpotifyAPICurrentUser = { id: string };

export interface SpotifyAPIUserPlaylists extends SpotifyAPIGetResponse {
  items: SpotifyAPIUserPlaylist[];
}

export type SpotifyAPIUserPlaylist = {
  tracks: { href: string };
  description: string;
  name: string;
  images: {
    url: string;
    height: number;
    width: number;
  }[];
  public: boolean;
  owner: {
    id: string;
  };
};

export interface SpotifyAPIPlaylistItems extends SpotifyAPIGetResponse {
  items: SpotifyAPIPlaylistItem[];
}

export type SpotifyAPIPlaylistItem = {
  track: {
    id: string;
    name: string;
    external_ids: {
      isrc: string;
    };
  };
  added_at: string;
};

export interface SpotifyAPIAlbums extends SpotifyAPIGetResponse {
  items: SpotifyAPIAlbumItem[];
}

export type SpotifyAPIAlbumItem = {
  added_at: string; // YYYY-MM-DDTHH:MM:SSZ
};
