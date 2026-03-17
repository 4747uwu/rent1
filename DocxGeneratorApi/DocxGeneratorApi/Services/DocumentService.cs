using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentFormat.OpenXml.Drawing.Wordprocessing; // For DocProperties
using Dwp = DocumentFormat.OpenXml.Drawing.Wordprocessing;
using A = DocumentFormat.OpenXml.Drawing; // For Blip
using DocxGeneratorApi.Models;
using HtmlToOpenXml;
using Microsoft.Extensions.Configuration;
using System.Text.RegularExpressions;

namespace DocxGeneratorApi.Services;

public class DocumentService
{
    private readonly string _templateFolderPath;

    public DocumentService(IWebHostEnvironment env, IConfiguration config)
    {
        var storagePath = config.GetValue<string>("TemplateSettings:StoragePath");
        if (Path.IsPathRooted(storagePath))
        {
            _templateFolderPath = storagePath;
        }
        else
        {
            _templateFolderPath = Path.Combine(env.ContentRootPath, storagePath);
        }

        if (!Directory.Exists(_templateFolderPath))
        {
            Directory.CreateDirectory(_templateFolderPath);
        }
    }

    public byte[] GenerateDocument(string templateName, Dictionary<string, string> placeholders)
    {
        var templatePath = Path.Combine(_templateFolderPath, templateName);
        System.Diagnostics.Debug.WriteLine($"--------------------------------------------------");
        System.Diagnostics.Debug.WriteLine($"[CRITICAL] LOADING TEMPLATE FROM: {templatePath}");
        System.Diagnostics.Debug.WriteLine($"[CRITICAL] File Size: {new FileInfo(templatePath).Length} bytes");
        System.Diagnostics.Debug.WriteLine($"--------------------------------------------------");
        if (!File.Exists(templatePath))
        {
            throw new FileNotFoundException("Template file not found.", templateName);
        }

        using var memoryStream = new MemoryStream();
        using (var fileStream = new FileStream(templatePath, FileMode.Open, FileAccess.Read))
        {
            fileStream.CopyTo(memoryStream);
        }

        using (var wordDocument = WordprocessingDocument.Open(memoryStream, true))
        {
            var mainPart = wordDocument.MainDocumentPart!;
            var converter = new HtmlConverter(mainPart);

            // 1. Process Main Body
            ProcessPart(mainPart, placeholders, converter);

            // 2. Process Headers
            foreach (var headerPart in mainPart.HeaderParts)
            {
                ProcessPart(headerPart, placeholders, converter);
            }

            // 3. Process Footers
            foreach (var footerPart in mainPart.FooterParts)
            {
                ProcessPart(footerPart, placeholders, converter);
            }

            mainPart.Document.Save();
        }
        return memoryStream.ToArray();
    }

    // Helper to run both Text and Image replacement on any document part
    private void ProcessPart(OpenXmlPart part, Dictionary<string, string> placeholders, HtmlConverter converter)
    {
        ReplaceTextInPart(part, placeholders, converter);
        ReplaceImagesInPart(part, placeholders);
    }

    private void ReplaceTextInPart(OpenXmlPart part, Dictionary<string, string> placeholders, HtmlConverter converter)
    {
        // We only care about keys that start with -- (text placeholders)
        var textPlaceholders = placeholders.Where(p => p.Key.StartsWith("--") || p.Key.StartsWith("{{"));

        foreach (var placeholder in textPlaceholders)
        {
            bool isHtml = placeholder.Value != null && placeholder.Value.Contains("<") && placeholder.Value.Contains(">");
            string cleanValue = placeholder.Value ?? string.Empty;

            var placeholderParagraphs = part.RootElement.Descendants<Paragraph>()
                .Where(p => p.InnerText.Contains(placeholder.Key))
                .ToList();

            foreach (var p in placeholderParagraphs)
            {
                if (isHtml)
                {
                    var elements = converter.Parse(cleanValue);
                    foreach (var element in elements)
                    {
                        p.Parent.InsertBefore(element.CloneNode(true), p);
                    }
                    p.Remove();
                }
                //else
                //{
                //    var matchingRun = p.Descendants<Run>()
                //       .FirstOrDefault(r => r.InnerText.Contains(placeholder.Key));

                //    var newRun = new Run(new Text(cleanValue));
                //    var runProperties = p.Descendants<Run>().FirstOrDefault()?.RunProperties;
                //    if (runProperties != null)
                //    {
                //        newRun.RunProperties = (RunProperties)runProperties.CloneNode(true);
                //    }
                //    p.RemoveAllChildren<Run>();
                //    p.Append(newRun);
                //}

                else
                {
                    // 1. Create the new text run
                    var newRun = new Run(new Text(cleanValue));

                    // 2. Try to preserve existing styles (font, size, etc.) from the template
                    var matchingRun = p.Descendants<Run>().FirstOrDefault(r => r.InnerText.Contains(placeholder.Key));
                    var sourceRun = matchingRun ?? p.Descendants<Run>().FirstOrDefault();

                    if (sourceRun != null && sourceRun.RunProperties != null)
                    {
                        newRun.RunProperties = (RunProperties)sourceRun.RunProperties.CloneNode(true);
                    }

                    // ============================================================
                    // 3. FORCE BOLD for specific fields (The "Nuclear Option")
                    // ============================================================
                    if (placeholder.Key == "--drname--" || placeholder.Key == "--department--")
                    {
                        // Ensure properties exist
                        if (newRun.RunProperties == null) newRun.RunProperties = new RunProperties();

                        // Turn ON Bold
                        newRun.RunProperties.Bold = new Bold();
                    }
                    // ============================================================

                    // 4. Replace the content
                    p.RemoveAllChildren<Run>();
                    p.Append(newRun);
                }
            }
        }
    }

    private void ReplaceImagesInPart(OpenXmlPart part, Dictionary<string, string> placeholders)
    {
        // 1. Get ALL drawings (The standard way for .docx)
        var drawings = part.RootElement.Descendants<Drawing>().ToList();

        System.Diagnostics.Debug.WriteLine($"[DEBUG] Scanning Part...");
        System.Diagnostics.Debug.WriteLine($"[DEBUG] Found {drawings.Count} 'Drawing' elements.");

        // Loop through Drawings
        foreach (var drawing in drawings)
        {
            // Try to find the name in DocProperties (standard)
            var docPr = drawing.Descendants<DocProperties>().FirstOrDefault();

            if (docPr != null)
            {
                string name = docPr.Name?.Value ?? "[No Name]";
                string id = docPr.Id?.Value.ToString() ?? "[No ID]";
                System.Diagnostics.Debug.WriteLine($"[DEBUG] -> Found Drawing: ID={id}, Name='{name}'");

                // CHECK MATCH
                if (placeholders.ContainsKey(name))
                {
                    System.Diagnostics.Debug.WriteLine($"[DEBUG]    *** MATCH FOUND for '{name}' ***");

                    string base64String = placeholders[name];
                    if (!string.IsNullOrEmpty(base64String))
                    {
                        try
                        {
                            // Clean base64
                            var match = Regex.Match(base64String, @"data:image/(?<type>.+?);base64,(?<data>.+)");
                            if (match.Success) base64String = match.Groups["data"].Value;

                            byte[] imageBytes = Convert.FromBase64String(base64String);

                            var blip = drawing.Descendants<A.Blip>().FirstOrDefault();
                            if (blip != null)
                            {
                                string embedId = blip.Embed;
                                ImagePart imagePart = (ImagePart)part.GetPartById(embedId);

                                // Overwrite the image data
                                using (var writer = new BinaryWriter(imagePart.GetStream(FileMode.Create)))
                                {
                                    writer.Write(imageBytes);
                                }
                                System.Diagnostics.Debug.WriteLine($"[DEBUG]    *** SUCCESS: Replaced image '{name}' ***");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"[DEBUG]    !!! ERROR replacing image: {ex.Message}");
                        }
                    }
                }
            }
            else
            {
                // Just for debug visibility
                System.Diagnostics.Debug.WriteLine($"[DEBUG] -> Found Drawing with NO DocProperties.");
            }
        }
    }
}