// Program.cs
using DocxGeneratorApi.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// ==> ADD THIS LINE TO REGISTER YOUR SERVICE <==
builder.Services.AddSingleton<DocumentService>();

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<DocxGeneratorApi.Services.QrCodeService>();

builder.Services.AddScoped<DocxGeneratorApi.Services.DocumentService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();