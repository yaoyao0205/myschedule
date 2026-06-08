import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count >= 2 else {
  FileHandle.standardError.write("Missing image path\n".data(using: .utf8)!)
  exit(64)
}

let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = NSImage(contentsOf: imageURL) else {
  FileHandle.standardError.write("Unable to read image\n".data(using: .utf8)!)
  exit(65)
}

var proposedRect = NSRect(origin: .zero, size: image.size)
guard let cgImage = image.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil) else {
  FileHandle.standardError.write("Unable to decode image\n".data(using: .utf8)!)
  exit(66)
}

var lines: [String] = []
let request = VNRecognizeTextRequest { request, error in
  if let error {
    FileHandle.standardError.write("\(error.localizedDescription)\n".data(using: .utf8)!)
    return
  }

  guard let observations = request.results as? [VNRecognizedTextObservation] else {
    return
  }

  lines = observations.compactMap { observation in
    observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
  }.filter { !$0.isEmpty }
}

request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])

print(lines.joined(separator: "\n"))
