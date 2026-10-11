'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@plumbline/core';
import { decide } from '@plumbline/checks/review';
import { setVerified } from '@plumbline/impact';

export async function reviewFinding(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const decision = formData.get('decision') === 'approve' ? 'approve' : 'reject';
  const note = String(formData.get('note') ?? '').trim() || null;
  decide(db(), id, decision, note);
  revalidatePath('/', 'layout');
}

/** Writes verified_by_ud into impact/library.yaml. Nothing is committed until UD runs plumb library-commit. */
export async function toggleSource(formData: FormData): Promise<void> {
  setVerified(String(formData.get('check')), Number(formData.get('index')), formData.get('verified') === 'true');
  revalidatePath('/library');
}

export async function confirmMention(formData: FormData): Promise<void> {
  const value = formData.get('confirmed');
  db().prepare('UPDATE ai_mentions SET confirmed = ? WHERE id = ?').run(value === 'yes' ? 1 : value === 'no' ? 0 : null, Number(formData.get('id')));
  revalidatePath('/ai');
}

export async function saveContact(formData: FormData): Promise<void> {
  const linkedin = String(formData.get('linkedin') ?? '').trim();
  if (linkedin && !/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(linkedin)) throw new Error('That is not a LinkedIn address');
  db().prepare('UPDATE contacts SET linkedin_url = ?, name_confirmed = ? WHERE id = ?').run(linkedin || null, formData.get('confirmed') === 'on' ? 1 : 0, Number(formData.get('id')));
  revalidatePath('/contacts');
}
