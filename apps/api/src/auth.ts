import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, memberAc, ownerAc } from 'better-auth/plugins/organization/access'
import { db, schema } from './db/index.ts'

// Functional roles share Better Auth's `member` permissions; owner/admin keep theirs.
const ac = createAccessControl(defaultStatements)
const functional = ac.newRole(memberAc.statements)
const roles = {
  owner: ownerAc,
  admin: adminAc,
  member: memberAc,
  fde: functional,
  engagement_manager: functional,
  account_exec: functional,
  csm: functional,
  product: functional,
}

// ponytail: single-org self-host mode. When AUTO_JOIN != "false", a new sign-up is added to the
// first organization that exists, so a team never has to wire up invitation email. Run this
// behind your network or set AUTO_JOIN=false and add members from Settings.
const autoJoin = process.env.AUTO_JOIN !== 'false'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  emailAndPassword: { enabled: true },
  plugins: [organization({ ac, roles, creatorRole: 'owner' })],
  databaseHooks: {
    user: {
      create: {
        after: async (u) => {
          if (!autoJoin) return
          const [org] = await db.select().from(schema.organization).orderBy(schema.organization.createdAt).limit(1)
          if (!org) return
          await db.insert(schema.member).values({
            id: crypto.randomUUID(),
            organizationId: org.id,
            userId: u.id,
            role: 'fde',
            createdAt: new Date(),
          })
        },
      },
    },
  },
})

export type Auth = typeof auth
