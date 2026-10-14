import importlib.util
import pathlib
import unittest
from unittest.mock import MagicMock, patch


spec = importlib.util.spec_from_file_location('worker', pathlib.Path(__file__).parents[1] / 'scripts' / 'whisper_worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class WhisperDeviceTests(unittest.TestCase):
    def tearDown(self):
        worker.unload_model()

    def test_auto_selects_cuda_and_cpu_honors_explicit_selection(self):
        with patch.object(worker.torch.cuda, 'is_available', return_value=True):
            self.assertEqual(worker.resolve_device('auto'), 'cuda')
            self.assertEqual(worker.resolve_device('cpu'), 'cpu')
        with patch.object(worker.torch.cuda, 'is_available', return_value=False):
            self.assertEqual(worker.resolve_device('auto'), 'cpu')
            with self.assertRaises(worker.DeviceError) as failure:
                worker.resolve_device('cuda')
            self.assertEqual(failure.exception.code, 'CUDA_UNAVAILABLE')

    def test_diagnosis_checks_computation_not_only_device_detection(self):
        with patch.object(worker.torch.cuda, 'is_available', return_value=True), \
                patch.object(worker.torch, 'ones', side_effect=RuntimeError('no kernel image is available')):
            with self.assertRaises(worker.DeviceError) as failure:
                worker.diagnose({'device': 'cuda'})
            self.assertEqual(failure.exception.code, 'CUDA_COMPUTE_FAILED')

    def test_reuses_model_until_device_or_model_changes(self):
        fake_model = MagicMock()
        with patch.object(worker.torch.cuda, 'is_available', return_value=True), \
                patch.object(worker.whisper, 'load_model', return_value=fake_model) as load:
            worker.ensure_model({'model': 'small', 'device': 'auto'})
            worker.ensure_model({'model': 'small', 'device': 'cuda'})
            self.assertEqual(load.call_count, 1)
            self.assertEqual(load.call_args.kwargs['device'], 'cuda')
            worker.ensure_model({'model': 'small', 'device': 'cpu'})
            self.assertEqual(load.call_count, 2)
            self.assertEqual(load.call_args.kwargs['device'], 'cpu')

    def test_transcription_uses_fp16_only_on_cuda_and_preserves_russian(self):
        for device, fp16 in [('cuda', True), ('cpu', False)]:
            fake_model = MagicMock()
            fake_model.transcribe.return_value = {'text': ' Привет ', 'language': 'ru'}
            with patch.object(worker, 'ensure_model', return_value=(fake_model, device)), \
                    patch.object(worker, 'load_audio_input', return_value='synthetic'), \
                    patch.object(worker.torch.cuda, 'is_available', return_value=False):
                result = worker.transcribe({'audio_path': 'not-a-real-file', 'language': 'ru'})
                self.assertEqual(result['text'], 'Привет')
                self.assertEqual(result['device'], device)
                self.assertEqual(fake_model.transcribe.call_args.kwargs['fp16'], fp16)
                self.assertEqual(fake_model.transcribe.call_args.kwargs['language'], 'ru')


if __name__ == '__main__':
    unittest.main()
