import api from "@/services/api";
import { Track } from "@/types";

interface SearchResponse {
  tracks: {
    offset: number
    next?: string | null
    items: Track[]
  }
}

function parseString(str: string) {
  return str.trim().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').toLowerCase()
}

export function getWordsCombinations(sentence: string) {
  const words = parseString(sentence).split(' ');

  // Generate all possible combinations with grouped adjacent words
  const combinations: string[][] = [];

  function backtrack(startIndex: number, currentGroup: string[]) {
    if (startIndex === words.length) {
      combinations.push(currentGroup.slice());
      return;
    }

    // Include the current element in the current group
    currentGroup.push(words[startIndex]);
    backtrack(startIndex + 1, currentGroup);
    currentGroup.pop();

    // Extend the last group with the current element
    if (currentGroup.length > 0) {
      currentGroup[currentGroup.length - 1] += ' ' + words[startIndex];
      backtrack(startIndex + 1, currentGroup);
      currentGroup[currentGroup.length - 1] = currentGroup[currentGroup.length - 1].slice(0, -1);
    }
  }

  backtrack(0, []);

  return combinations
}

export async function testCombinations(combinations: string[][], authToken: string) {
  const results = {} as { [key: string]: Track }

  async function queryByTitle(title: string, authToken: string, next?: string | null) {
    if (next === null) return { next: null, offset: -1, items: [] }

    const response = next
      ? await api.get<SearchResponse>(next, {
        headers: {
          Authorization: authToken
        }
      })
      : await api.get<SearchResponse>('https://api.spotify.com/v1/search', {
        params: {
          q: `track:${title}`,
          type: 'track',
          limit: 100,
        }, headers: {
          Authorization: authToken
        }
      })

    return response.data.tracks
  }

  async function getSongs(titles: string[], authToken: string) {
    return await Promise.all(titles.map((title) => new Promise(async (res, rej) => {
      if (title in results) return results[title]

      let musics: SearchResponse['tracks'] = { next: undefined, offset: 0, items: [] };
      let index = -1;
      do {
        try {
          // get song with the title exactly equal to the words
          musics = await queryByTitle(title, authToken, musics.next)
        } catch (err: any) {
          if (err.response.status === 429)
            rej('rate exceeded')
          else
            rej(err)
        }

        if (musics.next === null || musics.offset > 500 || musics.items.length === 0) rej('no songs found')

        index = musics.items.findIndex((el) => parseString(el.name) === title)
      } while (index < 0)

      const { id, name, artists } = musics.items[index]

      results[title] = { id, name, artists }

      res({ id, name, artists })
    })))
  }

  const CHUNK_SIZE = Math.min(10, combinations.length)

  for (let i = 0; i < combinations.length; i += CHUNK_SIZE) {
    const chunks = combinations.slice(i, Math.min(i + CHUNK_SIZE, combinations.length))

    try {
      const response = await Promise.any(chunks.map((el) => getSongs(el, authToken)))
      if (response) return response
    } catch (err) {
      continue
    }

  }

  return false
}