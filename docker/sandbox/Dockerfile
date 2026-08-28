# bash/git 工具的执行沙箱镜像（SandboxBackend 的 docker 后端）。
# security.sandbox.image 默认指向 `agent-engine/sandbox`；构建：
#   docker build -t agent-engine/sandbox docker/sandbox
FROM alpine:3.20

# git / curl 是 devops-agent 等场景的常用命令；bash 用于更完整的 shell 语义。
RUN apk add --no-cache bash git curl ca-certificates

CMD ["bash"]
