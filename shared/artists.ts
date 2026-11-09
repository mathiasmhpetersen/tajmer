// Artist roster lives in config, not a database. A campaign belongs to an artist
// if its name contains any `match` string (case-insensitive). Add an artist by
// appending one row here — the sidebar, overview and routing all read from this.
export interface Artist {
  slug: string;
  name: string;
  match: string[];
}

export const ARTISTS: Artist[] = [
  { slug: "linda-p", name: "Linda P", match: ["Linda P"] },
  { slug: "jakob-thrane", name: "Jakob Thrane", match: ["Jakob Thrane"] },
  {
    slug: "nikolaj-stokholm",
    name: "Nikolaj Stokholm",
    match: ["Nikolaj Stokholm", "Nikolaj Stoholm", "Stokke"],
  },
  { slug: "mark-le-fevre", name: "Mark Le Fevre", match: ["Mark Le Fevre", "Le Fèvre"] },
  { slug: "r8dio", name: "r8Dio", match: ["r8Dio", "R8Dio"] },
  { slug: "thomas-warberg", name: "Thomas Warberg", match: ["Thomas Warberg", "Warberg"] },
];

export const ARTISTS_BY_SLUG: Record<string, Artist> = Object.fromEntries(
  ARTISTS.map((a) => [a.slug, a]),
);

/** Does a campaign name belong to this artist? Case-insensitive substring match. */
export function campaignMatchesArtist(campaignName: string, artist: Artist): boolean {
  const haystack = campaignName.toLowerCase();
  return artist.match.some((m) => haystack.includes(m.toLowerCase()));
}

/** First artist whose match strings appear in the campaign name, else undefined. */
export function artistForCampaign(campaignName: string): Artist | undefined {
  return ARTISTS.find((a) => campaignMatchesArtist(campaignName, a));
}
