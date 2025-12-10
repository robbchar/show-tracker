const TVDB_BASE_URL = "https://api4.thetvdb.com/v4";

export interface TvdbShow {
  id: number;
  name: string;
  image?: string;
  status?: string;
  lastAired?: string;
}

export interface TvdbEpisode {
  id: number;
  seasonNumber: number;
  number: number;
  name: string;
  airDate?: string;
  absoluteNumber?: number;
}

export interface TvdbSearchResult {
  id: string;
  name: string;
  imageUrl?: string;
  year?: number;
}

interface LoginResponse {
  data: {
    token: string;
  };
}

interface SeriesResponse {
  data: {
    id: number;
    name: string;
    image?: string;
    status?: {
      name: string;
    };
    lastAired?: string;
  };
}

interface EpisodesResponse {
  data: {
    episodes: Array<{
      id: number;
      name: string;
      seasonNumber: number;
      number: number;
      aired?: string;
      absoluteNumber?: number;
    }>;
  };
}

interface SearchResponse {
  data: Array<{
    id?: number;
    tvdb_id?: number;
    name?: string;
    image_url?: string;
    first_air_time?: string;
    year?: number;
  }>;
}

export class TvdbClient {
  private token: string | undefined;

  constructor(
    private readonly apiKey: string,
    private readonly pin?: string,
    initialToken?: string
  ) {
    this.token = initialToken;
  }

  public async login(): Promise<string> {
    const res = await fetch(`${TVDB_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: this.apiKey, pin: this.pin }),
    });

    if (!res.ok) {
      throw new Error(`TVDB login failed (${res.status})`);
    }

    const json = (await res.json()) as LoginResponse;
    const token = json?.data?.token;
    if (!token) {
      throw new Error("TVDB login response missing token");
    }

    this.token = token;
    return token;
  }

  private async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    return this.login();
  }

  private async request<T>(path: string): Promise<T> {
    const token = await this.ensureToken();
    const res = await fetch(`${TVDB_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`TVDB request failed (${res.status}) for ${path}`);
    }

    return (await res.json()) as T;
  }

  async fetchShow(tvdbId: string): Promise<TvdbShow> {
    const payload = await this.request<SeriesResponse>(`/series/${tvdbId}`);
    const show = payload?.data;
    return {
      id: show.id,
      name: show.name,
      image: show.image,
      status: show.status?.name,
      lastAired: show.lastAired,
    };
  }

  async fetchEpisodes(tvdbId: string): Promise<TvdbEpisode[]> {
    const payload = await this.request<EpisodesResponse>(
      `/series/${tvdbId}/episodes/default?page=0`
    );
    const episodes = payload?.data?.episodes ?? [];
    return episodes.map((e) => ({
      id: e.id,
      name: e.name,
      seasonNumber: e.seasonNumber,
      number: e.number,
      airDate: e.aired,
      absoluteNumber: e.absoluteNumber,
    }));
  }

  async searchShows(query: string, limit = 15): Promise<TvdbSearchResult[]> {
    const payload = await this.request<SearchResponse>(
      `/search?query=${encodeURIComponent(query)}&type=series`
    );
    const data = payload?.data ?? [];

    const normalizeId = (value?: number | string): string | undefined => {
      if (value === undefined || value === null) return undefined;
      const asString = String(value);
      // TheTVDB can return ids like "series-73255" or raw numbers; strip the prefix if present.
      return asString.replace(/^series-/, "").trim();
    };

    return data
      .map((item) => {
        const id = normalizeId(item.tvdb_id ?? item.id);
        return {
          id,
          name: item.name ?? "Untitled",
          imageUrl: item.image_url,
          year: item.year,
        };
      })
      .filter((r) => !!r.id && !!r.name)
      .slice(0, limit) as TvdbSearchResult[];
  }
}

