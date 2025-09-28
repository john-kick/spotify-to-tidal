import type { StringMappingType } from "typescript";

export type SpotifyAPIError = {
  error: {
    status: number;
    message: string;
  };
};

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

export type SpotifyAPIUserTracksResponse = {
  items: {
    track: {
      id: string;
      name: string;
      external_ids: { isrc: string };
    };
    added_at: string;
  }[];
  next?: string;
};

export type SpotifyAPICurrentUser = { id: string };

export type SpotifyAPIUserPlaylists = {
  items: {
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
  }[];
  next?: string;
};

export type SpotifyAPIPlaylistItems = {
  items: {
    track: {
      id: string;
      name: string;
      external_ids: {
        isrc: string;
      };
    };
    added_at: string;
  }[];
  next?: string;
};

export type SpotifyAPIAlbums = {
  items: SpotifyAPIAlbumItem[];
  next?: string;
};

export type SpotifyAPIAlbumItem = {
  added_at: string; // YYYY-MM-DDTHH:MM:SSZ
};
