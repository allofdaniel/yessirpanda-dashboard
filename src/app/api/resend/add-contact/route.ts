import { NextRequest, NextResponse } from 'next/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY

// Add a contact to Resend audience
export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured')
      return NextResponse.json({ error: 'Resend not configured' }, { status: 500 })
    }

    // First, get or create audience
    const audiencesRes = await fetch('https://api.resend.com/audiences', {
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
    })

    let audienceId: string | null = null

    if (audiencesRes.ok) {
      const { data: audiences } = await audiencesRes.json()
      const yessirpandaAudience = audiences?.find((a: { name: string }) => a.name === 'yessirpanda')

      if (yessirpandaAudience) {
        audienceId = yessirpandaAudience.id
      } else {
        // Create new audience
        const createRes = await fetch('https://api.resend.com/audiences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'yessirpanda' }),
        })

        if (createRes.ok) {
          const { id } = await createRes.json()
          audienceId = id
        }
      }
    }

    if (!audienceId) {
      return NextResponse.json({ error: 'Failed to get/create audience' }, { status: 500 })
    }

    // Add contact to audience
    const contactRes = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        first_name: name || '학습자',
        unsubscribed: false,
      }),
    })

    if (!contactRes.ok) {
      const errorData = await contactRes.json()
      // If contact already exists, that's fine
      if (errorData.message?.includes('already exists')) {
        return NextResponse.json({ success: true, message: 'Contact already exists' })
      }
      console.error('Failed to add contact:', errorData)
      return NextResponse.json({ error: 'Failed to add contact' }, { status: 500 })
    }

    const contactData = await contactRes.json()
    return NextResponse.json({ success: true, contactId: contactData.id })
  } catch (error) {
    console.error('Error adding contact to Resend:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
