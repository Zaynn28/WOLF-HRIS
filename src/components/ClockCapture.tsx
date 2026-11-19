import { useEffect, useRef, useState } from 'react';

export const MAX_PUNCH_ACCURACY_METERS = 250;

export interface ClockProof {
  photo: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function ClockCapture({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: (proof: ClockProof) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [gpsError, setGpsError] = useState('');

  const canSave = Boolean(photo) && !cameraError;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

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
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
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
    const longest = Math.max(video.videoWidth, video.videoHeight);
    const scale = Math.min(1, 960 / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL('image/jpeg', 0.72));
  };

  const confirm = () => {
    if (!photo || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      position => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        };
        setLocation(next);
        if (next.accuracy > MAX_PUNCH_ACCURACY_METERS) return;
        streamRef.current?.getTracks().forEach(track => track.stop());
        onConfirm({ photo, ...next });
      },
      () => setGpsError('Location permission is required.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700" aria-label="Close">Close</button>
        </div>
        <p className="text-sm text-slate-500">
          Take the photo with this camera. The punch is saved only when the location is accurate to {MAX_PUNCH_ACCURACY_METERS} metres and you are inside a punch site.
        </p>
        <div className="rounded-lg overflow-hidden bg-slate-900 aspect-video">
          {photo ? <img src={photo} alt="Clock photo" className="w-full h-full object-cover" /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}
        </div>
        {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}
        <p className="text-sm text-slate-600">
          {location ? `GPS ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} · ±${location.accuracy} m` : (gpsError || 'Waiting for GPS…')}
        </p>
        {location && location.accuracy > MAX_PUNCH_ACCURACY_METERS && (
          <p className="text-sm text-red-600">The location is too coarse. Accuracy must be {MAX_PUNCH_ACCURACY_METERS} metres or better.</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">Cancel</button>
          {!photo && <button type="button" onClick={takePhoto} disabled={!!cameraError} className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm">Take photo</button>}
          {photo && <button type="button" onClick={() => setPhoto(null)} className="px-3 py-2 text-sm text-slate-600">Retake</button>}
          <button type="button" onClick={confirm} disabled={!canSave} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:bg-slate-200 disabled:text-slate-400">Save punch</button>
        </div>
      </div>
    </div>
  );
}
