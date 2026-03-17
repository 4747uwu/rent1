// Controllers/DocumentController.cs
using DocxGeneratorApi.Models;
using DocxGeneratorApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace DocxGeneratorApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DocumentController : ControllerBase
{
    private readonly DocumentService _documentService;
    private readonly QrCodeService _qrService;
    private readonly IConfiguration _config;

    // Inject the new services
    public DocumentController(
        DocumentService documentService,
        QrCodeService qrService,
        IConfiguration config)
    {
        _documentService = documentService;
        _qrService = qrService;
        _config = config;
    }

    [HttpPost("generate")]
    public IActionResult GenerateDocx([FromBody] GenerateDocxRequest request)
    {
        try
        {
            // 1. Validation: We need a StudyId to make a working QR code
            if (string.IsNullOrEmpty(request.StudyId))
            {
                return BadRequest(new { message = "StudyId is required to generate the QR code." });
            }

            // 2. Build the QR Code URL
            // This is the link that will be "burned" into the QR image.
            // It points to your Node.js backend (which handles the redirect/download).
            // Example: https://hospital-api.com/scan/507f1f77bcf86cd799439011
            string backendBaseUrl = _config["NodeBackendBaseUrl"] ?? "http://64.227.187.164:3000/api/scan";
            string qrPayload = $"{backendBaseUrl}/{request.StudyId}";

            // 3. Generate the QR Image (Base64)
            string qrBase64 = _qrService.GenerateQrCodeBase64(qrPayload);

            // 4. Inject the QR into the placeholders
            // Ensure your Request.Placeholders is not null
            if (request.Placeholders == null) request.Placeholders = new Dictionary<string, string>();

            // IMPORTANT: In your Word Template, you must have an image named "QR Placeholder" 
            // in the Selection Pane for this to work.
            request.Placeholders["QR Placeholder"] = qrBase64;

            // 5. Generate the Document
            // The DocumentService will now replace text AND the "QR Placeholder" image
            var fileBytes = _documentService.GenerateDocument(request.TemplateName, request.Placeholders);

            // 6. Return the File
            // We return the raw file bytes so Node.js can receive it and upload it to Wasabi.
            string contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            string fileName = $"Report-{request.StudyId}.docx";

            return File(fileBytes, contentType, fileName);
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred during document generation.", details = ex.Message });
        }
    }
}