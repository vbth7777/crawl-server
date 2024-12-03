function sleep(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay))
}
async function main() {
  const posts = document.querySelectorAll('.mdui-col > a')
  let win = window.open(posts[0], '_blank');
  for (let post of posts) {
    win.location.href = post.href
    while (true) {
      await sleep(1000)
      console.log(win.document.querySelector('.mdui-video-fluid'))
      if (win.document.querySelector('.mdui-video-fluid')) {
        console.log('post')
        const link = win.document.querySelector('.mdui-video-fluid source').src
        const name = win.document.querySelector('.title').innerText

        fetch('http://localhost:9394/api/download', {
          method: 'post',
          body: new URLSearchParams({
            url: link,
            name
          })
        }).then(err => console.log(err))

        break
      }
    }

  }
}
main()
