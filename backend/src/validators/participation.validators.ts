import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const submitFieldsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().int().min(0).max(10_000).optional(),
  deviceTimestamp: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type SubmitFieldsInput = z.infer<typeof submitFieldsSchema>;
