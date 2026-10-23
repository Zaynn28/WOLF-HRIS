import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { OFFICE_PUNCH_RADIUS_METERS, officePunchCheck, punchRejection, readyOfficePin } from '../lib/officeLocation';

export interface ClockProof {
  photo: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function ClockCapture({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: (proof: ClockProof) => void }) {
  const { officeLocation } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [gpsError, setGpsError] = useState('');
  const office = readyOfficePin(officeLocation);
  const range = location ? officePunchCheck(location.latitude, location.longitude, office) : null;
  const canSave = !punchRejection(photo, location?.latitude ?? Number.NaN, location?.longitude ?? Number.NaN, office);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation) {
      setGpsError('This browser has no location service.');
    } else {
      navigator.geolocation.getCurrentPosition(
        position => {
          if (cancelled) return;
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
          });
        },
        () => { if (!cancelled) setGpsError('Location permission is required.'); },
        { enableHighAccuracy: true, timeout: 12000 },
      );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser has no camera.');
    } else {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(stream => {
          if (cancelled) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => { if (!cancelled) setCameraError('Camera permission is required.'); });
    }
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setPhoto(canvas.toDataURL('image/jpeg', 0.7));
  };

  const confirm = () => {
    if (!photo || !location) return;
    if (punchRejection(photo, location.latitude, location.longitude, office)) return;
    streamRef.current?.getTracks().forEach(track => track.stop());
    onConfirm({ photo, ...location });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">
          A photo and a GPS fix are stored with this punch. Save punch is available only within {OFFICE_PUNCH_RADIUS_METERS.toLocaleString('en-US')} m of the office.
        </p>
        <div className="rounded-lg overflow-hidden bg-slate-900 aspect-video">
          {photo ? <img src={photo} alt="Clock photo" className="w-full h-full object-cover" /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}
        </div>
        {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}
        <p className="text-sm text-slate-600">
          {location ? `GPS ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} · ±${location.accuracy} m` : (gpsError || 'Waiting for GPS…')}
        </p>
        {!office && (
          <p className="text-sm text-amber-700">Office location is not set. HR must set the office pin in Configuration before a punch can be saved.</p>
        )}
        {office && !location && (
          <p className="text-sm text-slate-600">Office: {office.name}. You must be within {OFFICE_PUNCH_RADIUS_METERS.toLocaleString('en-US')} m to save this punch.</p>
        )}
        {office && range && (
          <p className={`text-sm ${range.allowed ? 'text-emerald-700' : 'text-red-600'}`}>{range.message}</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-slate-600">Cancel</button>
          {!photo && <button type="button" onClick={takePhoto} disabled={!!cameraError} className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm">Take photo</button>}
          {photo && <button type="button" onClick={() => setPhoto(null)} className="px-3 py-2 text-sm text-slate-600">Retake</button>}
          <button type="button" onClick={confirm} disabled={!canSave} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:bg-slate-200 disabled:text-slate-400">Save punch</button>
        </div>
      </div>
    </div>
  );
}
