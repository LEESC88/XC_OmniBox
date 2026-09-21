from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import CORS_ORIGINS
from app.core.exceptions import ToolboxException
from app.api.v1.health import router as health_router
from app.api.v1.document import router as document_router
from app.api.v1.pdf_ops import router as pdf_ops_router
from app.api.v1.editor import router as editor_router
from app.api.v1.image import router as image_router

app = FastAPI(
    title="XC_OmniBox 后端核心 API",
    description="支持高质量 Word/PDF 互转 (300+ DPI 保真)、PDF 在线所见即所得编辑、PDF 页面管理与水印安全服务、图片多功能处理服务",
    version="1.2.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# 配置跨域中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"^(http://localhost|http://127\.0\.0\.1|app://).*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册统一业务异常捕获
@app.exception_handler(ToolboxException)
async def toolbox_exception_handler(request: Request, exc: ToolboxException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.message}
    )

# 挂载路由模块
app.include_router(health_router, prefix="/api/v1")
app.include_router(document_router, prefix="/api/v1")
app.include_router(pdf_ops_router, prefix="/api/v1")
app.include_router(editor_router, prefix="/api/v1")
app.include_router(image_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
def root():
    return {
        "project": "OmniToolbox Backend",
        "status": "online",
        "swagger_docs": "/docs",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
