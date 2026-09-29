import { cache } from 'react'
import { prisma } from '@/lib/prisma'

// A published job as the public careers page, its metadata and its social preview image see it.
// Cached per request so those three only query the database once between them.
export const getPublishedJob = cache((slug: string) =>
  prisma.job.findFirst({
    where: { OR: [{ slug }, { id: slug }], status: 'published' },
    select: {
      title: true,
      slug: true,
      description: true,
      listing: true,
      tags: true,
      createdAt: true,
      owner: { select: { company: { select: { name: true, about: true, location: true, website: true } } } },
    },
  })
)
