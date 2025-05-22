import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { date, z } from "zod";

const prisma = new PrismaClient();
const router = Router();

const blogPostSchema = z.object({
  title: z.string().min(5).max(160),
  description: z.string().min(10).max(300),
  author: z.string().min(3).max(100),
  date: z.string(),
  coverImg: z.string(),
  slug: z
    .string()
    .regex(
      /^\/blog\/[a-z0-9]+$/i,
      "slug must start with /blog/ and be kebab-case"
    ),
  content: z.string().min(10).max(10000),
  tags: z.array(z.string()),
});
type BlogPostInput = z.infer<typeof blogPostSchema>;

// Blog Posts
router.get("/posts", async (_req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({ orderBy: { date: "desc" } });
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

router.get("/posts/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

router.post("/posts", async (req, res, next) => {
  try {
    /* 1. validate body */
    const parse = blogPostSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ errors: parse.error.format() });
    }

    const data: BlogPostInput = parse.data;

    /* 2. write to DB (handle unique slug) */
    const created = await prisma.blogPost.create({ data });
    res.status(201).json(created);
  } catch (err: any) {
    /* duplicate slug constraint */
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    next(err);
  }
});

router.put("/posts/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const parse = blogPostSchema.partial().safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ errors: parse.error.format() });
    }

    const updated = await prisma.blogPost.update({
      where: { id },
      data: parse.data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/posts/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    await prisma.blogPost.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
