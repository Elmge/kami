import dayjs from 'dayjs'
import { pick } from 'lodash-es'
import type { NextPage } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { FC } from 'react'
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { message } from 'react-message-popup'
import { shallow } from 'zustand/shallow'

import type { PostModel } from '@mx-space/api-client'
import { Loading } from '@mx-space/kami-design'
import { Banner } from '@mx-space/kami-design/components/Banner'
import {
  GgCoffee,
  PhBookOpen,
} from '@mx-space/kami-design/components/Icons/for-note'
import {
  FeHash,
  IonThumbsup,
  MdiCalendar,
} from '@mx-space/kami-design/components/Icons/for-post'
import { ImageSizeMetaContext } from '@mx-space/kami-design/contexts/image-size'

import { usePostCollection } from '~/atoms/collections/post'
import type { ModelWithDeleted } from '~/atoms/collections/utils/base'
import { wrapperNextPage } from '~/components/app/WrapperNextPage'
import Outdate from '~/components/biz/Outdate'
import { Seo } from '~/components/biz/Seo'
import { PostRelated } from '~/components/in-page/Post/post-related'
import { ArticleLayout } from '~/components/layouts/ArticleLayout'
import { Markdown } from '~/components/universal/Markdown'
import type { ActionProps } from '~/components/widgets/ArticleAction'
import { SearchFAB } from '~/components/widgets/Search'
import { SubscribeBell } from '~/components/widgets/SubscribeBell'
import { XLogInfoForPost } from '~/components/widgets/xLogInfo'
import { XLogSummaryForPost } from '~/components/widgets/xLogSummary'
import { useSetHeaderMeta, useSetHeaderShare } from '~/hooks/use-header-meta'
import { useInitialData, useThemeConfig } from '~/hooks/use-initial-data'
import { useIsClient } from '~/hooks/use-is-client'
import { useJumpToSimpleMarkdownRender } from '~/hooks/use-jump-to-render'
import { useBackgroundOpacity } from '~/hooks/use-kami'
import { isEqualObject } from '~/utils/_'
import { apiClient } from '~/utils/client'
import { isLikedBefore, setLikeId } from '~/utils/cookie'
import { imagesRecord2Map } from '~/utils/images'
import { getSummaryFromMd } from '~/utils/markdown'
import { springScrollToTop } from '~/utils/spring'
import { noop } from '~/utils/utils'

import { Copyright } from '../../../components/widgets/Copyright'

const ArticleFooterAction = dynamic(() =>
  import('~/components/widgets/ArticleAction').then(
    (mo) => mo.ArticleFooterAction,
  ),
)
const DonatePopover = dynamic(() =>
  import('~/components/widgets/Donate').then((mo) => mo.DonatePopover),
)
const CommentLazy = dynamic(() =>
  import('~/components/widgets/Comment').then((mo) => mo.CommentLazy),
)

const NumberTransition = dynamic(() =>
  import('~/components/universal/NumberRecorder').then(
    (mo) => mo.NumberTransition,
  ),
)

const useUpdatePost = (post: ModelWithDeleted<PostModel>) => {
  const beforeModel = useRef<PostModel>()
  const router = useRouter()

  useEffect(() => {
    const before = beforeModel.current

    if (!before && post) {
      beforeModel.current = { ...post }
      return
    }
    if (!before || !post) {
      return
    }
    if (before.id === post.id) {
      if (isEqualObject(before, post)) {
        return
      }

      if (
        before.categoryId !== post.categoryId ||
        (before.slug !== post.slug && post.category?.slug)
      ) {
        router.replace(
          '/posts/' + `${post.category.slug}/${post.slug}`,
          undefined,
          { shallow: true, scroll: false },
        )
        return
      }
      if (post.isDeleted) {
        router.push('/posts')

        message.error('文章已删除或隐藏')
        return
      }
      message.info('文章已更新')
    }

    beforeModel.current = { ...post }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    post?.id,
    post?.slug,
    post?.categoryId,

    post?.text,
    post?.summary,
    post?.category?.slug,
    post?.isDeleted,
  ])
}

const Seo$: FC<{ id: string }> = ({ id }) => {
  const {
    title,
    summary,
    category,
    created,
    modified,
    tags,
    text,
    images,
    meta,
  } = usePostCollection((state) =>
    pick(state.data.get(id)!, [
      'title',
      'summary',
      'created',
      'modified',
      'category',
      'tags',
      'text',
      'images',
      'meta',
    ]),
  )
  const description = summary ?? getSummaryFromMd(text).slice(0, 150)
  return (
    <Seo
      title={title}
      description={description}
      canUseRandomImage={false}
      image={meta?.cover || images?.[0]?.src}
      openGraph={{
        type: 'article',
        article: {
          publishedTime: created,
          modifiedTime: modified || undefined,
          section: category.name,
          tags: tags ?? [],
        },
      }}
    />
  )
}

const FooterActionBar: FC<{ id: string }> = ({ id }) => {
  const [actions, setActions] = useState<ActionProps>({})

  const post = usePostCollection(
    (state) => state.data.get(id) || (noop as PostModel),
  )

  const themeConfig = useThemeConfig()
  const donateConfig = themeConfig.function.donate
  const createTime = dayjs(post.created)
    .locale('cn')
    .format('YYYY 年 M 月 D 日')

  useEffect(() => {
    setActions({
      informs: [
        {
          icon: <MdiCalendar />,
          name: createTime,
        },
        {
          icon: <FeHash />,
          name: `${post.category.name}${
            post.tags.length ? `[${post.tags[0]}]` : ''
          }`,

          tip: () => (
            <div className="leading-7">
              <p>
                分类：
                <Link href={`/categories/${post.category.slug}`}>
                  {post.category.name}
                </Link>
              </p>
              <p>{post.tags.length ? `标签：${post.tags.join(', ')}` : ''}</p>
            </div>
          ),
        },
        {
          icon: <PhBookOpen />,
          name: post.count.read ?? 0,
        },
      ],

      actions: [
        donateConfig.enable && {
          icon: <GgCoffee />,
          name: '',
          wrapperComponent: DonatePopover,
          callback: () => {
            window.open(donateConfig.link)
          },
        },
        {
          icon: <IonThumbsup />,
          name: (
            <span className="leading-[1.1] inline-flex items-center">
              <NumberTransition number={post.count?.like || 0} />
            </span>
          ),
          color: isLikedBefore(post.id) ? '#f1c40f' : undefined,
          callback: () => {
            if (isLikedBefore(post.id)) {
              return message.error('你已经支持过啦！')
            }

            apiClient.post.thumbsUp(post.id).then(() => {
              message.success('感谢支持！')

              setLikeId(post.id)
              usePostCollection.getState().up(post.id)
            })
          },
        },
      ],
      copyright: post.copyright,
    })
  }, [
    post.id,
    post.category.name,
    post.copyright,
    post.count.read,
    post.tags,
    donateConfig.enable,
    donateConfig.link,
    post.count.like,
    post.count,
    createTime,
    post.category.slug,
  ])

  return <ArticleFooterAction {...actions} />
}

const PostUpdateObserver: FC<{ id: string }> = memo(({ id }) => {
  const post = usePostCollection((state) => state.data.get(id))
  useUpdatePost(post!)
  return null
})

export const PostView: PageOnlyProps = (props) => {
  const post = usePostCollection(
    (state) =>
      pick(state.data.get(props.id)!, [
        'title',
        'category',
        'id',
        'images',
        'summary',
        'created',
        'modified',
        'text',
        'copyright',
        'allowComment',
      ]),
    shallow,
  )

  const {
    url: { webUrl },
  } = useInitialData()

  useEffect(() => {
    springScrollToTop()
  }, [props.id])

  // header meta
  useSetHeaderMeta(post.title, post.category.name)
  useSetHeaderShare(post.title)

  useBackgroundOpacity(0.2)
  useJumpToSimpleMarkdownRender(post.id)

  const isClientSide = useIsClient()

  const imagesMap = useMemo(() => imagesRecord2Map(post.images), [post.images])

  return (
    <>
      <Seo$ id={post.id} />
      <ArticleLayout
        title={post.title}
        id={post.id}
        type="post"
        titleAnimate={false}
      >
        {post.summary ? (
          <Banner
            type="info"
            placement="left"
            showIcon={false}
            className="mb-8"
          >
            <p className="leading-[1.7]">摘要： {post.summary}</p>
          </Banner>
        ) : (
          <XLogSummaryForPost id={post.id} />
        )}
        <Outdate time={post.modified || post.created} />
        <ImageSizeMetaContext.Provider value={imagesMap}>
          <article>
            <h1 className="sr-only">{post.title}</h1>
            <Markdown codeBlockFully value={post.text} toc />
          </article>
        </ImageSizeMetaContext.Provider>

        <PostRelated id={post.id} />
        <SubscribeBell defaultType="post_c" />
        {post.copyright && isClientSide ? (
          <Copyright
            date={post.modified}
            link={new URL(location.pathname, webUrl).toString()}
            title={post.title}
          />
        ) : null}

        <XLogInfoForPost id={post.id} />
        <FooterActionBar id={post.id} />

        <CommentLazy
          key={post.id}
          id={post.id}
          allowComment={post.allowComment ?? true}
        />

        <SearchFAB />
      </ArticleLayout>

      <PostUpdateObserver id={post.id} />
    </>
  )
}

const NextPostView: NextPage<PostModel> = (props) => {
  const { id } = props
  const postId = usePostCollection((state) => state.data.get(id)?.id)

  if (!postId) {
    usePostCollection.getState().add(props)
    return <Loading />
  }

  return <PostView id={id} />
}

NextPostView.getInitialProps = async (ctx) => {
  const { query } = ctx
  const { category, slug } = query as any
  const data = await usePostCollection.getState().fetchBySlug(category, slug)

  return data
}

export default wrapperNextPage(NextPostView)
