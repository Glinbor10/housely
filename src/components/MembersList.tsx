import { useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'

interface Person {
  id: string
  name: string
  // Whether a phone has claimed this person
  claimed: boolean
}

interface MembersListProps {
  members: Person[]
  currentMemberId: string
  // Only the owner of the flat can release people
  canManage: boolean
  busy: boolean
  error: string | null
  onRelease: (memberId: string) => void
}

export const MembersList = ({
  members,
  currentMemberId,
  canManage,
  busy,
  error,
  onRelease,
}: MembersListProps) => {
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <Stack spacing={1}>
      <Typography variant="h6">People</Typography>
      {members.map((member) => {
        const isMe = member.id === currentMemberId
        return (
          <Stack key={member.id} spacing={1}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>{isMe ? `${member.name} (you)` : member.name}</Typography>
              {member.claimed ? (
                canManage && !isMe ? (
                  <Button
                    size="small"
                    color="warning"
                    aria-label={`Release ${member.name}`}
                    onClick={() => setConfirming(member.id)}
                  >
                    Release
                  </Button>
                ) : null
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Waiting for {member.name} to join
                </Typography>
              )}
            </Stack>
            {confirming === member.id ? (
              <Alert
                severity="warning"
                action={
                  <Stack direction="row" spacing={1}>
                    <Button color="inherit" onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                    <Button
                      color="inherit"
                      disabled={busy}
                      onClick={() => {
                        onRelease(member.id)
                        setConfirming(null)
                      }}
                    >
                      Yes, release
                    </Button>
                  </Stack>
                }
              >
                {member.name} will lose access on their current phone and can rejoin with the invite
                code. What they already cleaned is kept.
              </Alert>
            ) : null}
          </Stack>
        )
      })}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  )
}
