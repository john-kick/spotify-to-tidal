export type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  isrc: string;
};

export type SpotifyPlaylistTrack = {
  isrc: string;
  addedAt: string;
};

export type SpotifyImage = {
  url: string;
  height: number;
  width: number;
};

export type SpotifyPlaylist = {
  description: string;
  images: SpotifyImage[];
  name: string;
  public: boolean;
  tracks: SpotifyPlaylistTrack[];
};

export type SpotifyError = {
  error: {
    status: number;
    message: string;
  };
};

export type SpotifyAPIImageObject = {
  url: string;
  height: number;
  width: number;
};

export type SpotifyAPISimplifiedPlaylistObject = {
  collaborative: boolean;
  description: string;
  external_urls: { spotify: string };
  href: string;
  id: string;
  images: SpotifyAPIImageObject[];
  name: string;
  owner: {
    external_urls: { spotify: string };
    href: string;
    id: string;
    type: "user";
    uri: string;
    display_name: string | null;
  };
  public: boolean;
  snapshot_id: string;
  tracks: {
    href: string;
    total: number;
  };
  type: "playlist";
  uri: string;
};

export type SpotifyAPIUserPlaylistsObject = {
  href: string;
  limit: number;
  offset: number;
  next: string;
  previous: string;
  total: number;
  items: SpotifyAPISimplifiedPlaylistObject[];
};

export type SpotifyAPIPlaylistItemsObject = {
  href: string;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
  total: number;
  items: SpotifyAPIPlaylistTrackObject[];
};

export type SpotifyAPIPlaylistTrackObject = {
  added_at: string;
  added_by: {
    external_urls: { spotify: string };
    href: string;
    id: string;
    type: "user";
    uri: string;
  };
  is_local: boolean;
  track: {
    external_ids: {
      isrc: string;
    };
  };
};
