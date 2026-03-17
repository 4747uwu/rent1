// Models/GenerateDocxRequest.cs
namespace DocxGeneratorApi.Models
{
    public class GenerateDocxRequest
    {
        public string TemplateName { get; set; }
        public Dictionary<string, string> Placeholders { get; set; }

        public string StudyId { get; set; } = string.Empty;
    }
}