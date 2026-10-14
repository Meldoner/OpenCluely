"""Device/compute probe; --smoke uses existing weights and synthetic silence only."""
import argparse
import json
import os
import sys
import tempfile
import time
import wave


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='cuda')
    parser.add_argument('--model', default='small')
    parser.add_argument('--model-dir')
    parser.add_argument('--smoke', action='store_true')
    args = parser.parse_args()
    info = {'python': sys.executable, 'requested_device': args.device}
    worker = None
    try:
        import whisper_worker as worker
        info.update(torch=worker.torch.__version__, torch_cuda=worker.torch.version.cuda,
                    cuda_available=worker.torch.cuda.is_available(),
                    compiled_arches=worker.torch.cuda.get_arch_list())
        info.update(worker.diagnose({'device': args.device}))
        if args.smoke:
            if not args.model_dir or not os.path.isfile(os.path.join(args.model_dir, args.model + '.pt')):
                raise ValueError('--smoke requires --model-dir containing existing model weights; this probe does not download models')
            with tempfile.TemporaryDirectory(prefix='opencluely-whisper-probe-') as directory:
                audio_path = os.path.join(directory, 'silence.wav')
                with wave.open(audio_path, 'wb') as audio:
                    audio.setnchannels(1)
                    audio.setsampwidth(2)
                    audio.setframerate(16000)
                    audio.writeframes(bytes(32000))
                started = time.monotonic()
                # Loading by an explicit checkpoint path avoids Whisper's
                # automatic checksum/download branch for named models.
                checkpoint = os.path.join(args.model_dir, args.model + '.pt')
                result = worker.transcribe({'device': args.device, 'model': checkpoint,
                                           'model_dir': args.model_dir, 'language': 'ru', 'audio_path': audio_path})
                info.update(model=args.model, model_device=str(next(worker.model.parameters()).device),
                            smoke_transcription_succeeded=True, elapsed_seconds=round(time.monotonic() - started, 3))
                # This is a compute smoke check, not a speech accuracy benchmark.
        info['success'] = True
    except Exception as error:
        info.update(success=False, error=str(error), code=getattr(error, 'code', None))
    finally:
        if worker is not None:
            worker.unload_model()
    print(json.dumps(info, ensure_ascii=False))
    return 0 if info['success'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
