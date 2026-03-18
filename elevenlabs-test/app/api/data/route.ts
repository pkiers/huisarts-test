import { NextRequest, NextResponse } from "next/server";
import {
  getPatients, getDoctors, getSlots,
  setPatients, setDoctors, setSlots,
} from "../../lib/data-store";

export async function GET() {
  return NextResponse.json({
    patients: getPatients(),
    doctors: getDoctors(),
    slots: getSlots(),
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.patients) setPatients(body.patients);
    if (body.doctors) setDoctors(body.doctors);
    if (body.slots) setSlots(body.slots);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}
