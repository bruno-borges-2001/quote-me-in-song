import { NextRequest, NextResponse } from "next/server"
import { getWordsCombinations, testCombinations } from "./utils"
import api from "@/services/api"

export async function POST(request: NextRequest) {
  try {
    const { quote } = await request.json()

    // get auth token
    const response = await api.post('https://accounts.spotify.com/api/token', {
      grant_type: 'client_credentials',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET
    }, {
      headers: {
        "Content-Type": 'application/x-www-form-urlencoded'
      }
    })

    const authHeader = response.data.token_type + ' ' + response.data.access_token

    if (!quote) return NextResponse.error()

    // get possible combinations
    const combinations = getWordsCombinations(quote)

    // get songs
    const playlist = await testCombinations(combinations, authHeader)

    return NextResponse.json({ combinations, playlist })
  } catch (err) {
    console.log(err)
  }
}