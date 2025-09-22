export type SpotifyAPIError = {
  error: {
    status: number;
    message: string;
  };
};

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

export type SpotifyPlaylist = {
  description: string;
  images: SpotifyImage[];
  name: string;
  public: boolean;
  tracks: SpotifyPlaylistTrack[];
};

export type SpotifyImage = {
  url: string;
  height: number;
  width: number;
};

export type SpotifyAPIUserTracksResponse = { items: any[]; next?: string };

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
      external_ids: {
        isrc: string;
      };
    };
    added_at: string;
  }[];
  next?: string;
};
