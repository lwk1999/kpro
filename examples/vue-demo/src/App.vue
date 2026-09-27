<script setup lang="ts">
import {
  GuideProvider,
  KProGuide,
  useGuide,
  type GuideStepChangePayload,
} from '@kpro/vue';
import { computed, ref } from 'vue';

/** 指引组一：新手引导（三步，走完登记流程）。 */
const onboarding = useGuide('onboarding');
/** 指引组二：数据面板引导（两组可同时存在，互不干扰）。 */
const analytics = useGuide('analytics');
/** 指引组三：演示四种浮层方位。 */
const placementGuide = useGuide('placement');

const logs = ref<string[]>([]);

function log(message: string): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  logs.value = [`[${time}] ${message}`, ...logs.value].slice(0, 12);
}

function describe(payload: GuideStepChangePayload): string {
  return `${payload.from ?? '无'} → ${payload.to ?? '结束'}`;
}

const dismissedSummary = computed(() => {
  const groups: Array<[string, boolean]> = [
    ['onboarding', onboarding.isDismissed],
    ['analytics', analytics.isDismissed],
    ['placement', placementGuide.isDismissed],
  ];
  return groups.map(([id, value]) => `${id}: ${value ? '已不再提示' : '可见'}`).join(' · ');
});

const placementButtons: Array<{ serial: number; placement: 'top' | 'right' | 'bottom' | 'left'; label: string }> = [
  { serial: 1, placement: 'top', label: '上方' },
  { serial: 2, placement: 'right', label: '右侧' },
  { serial: 3, placement: 'bottom', label: '下方' },
  { serial: 4, placement: 'left', label: '左侧' },
];

function resetAll(): void {
  onboarding.reset();
  analytics.reset();
  placementGuide.reset();
  log('已重置所有「不再提示」标记');
}
</script>

<template>
  <div class="demo">
    <header class="demo__header">
      <h1>kpro 指引组件 · Vue 3 演示</h1>
      <p>
        点击下方按钮启动引导。目标 DOM 写在 <code>KProGuide</code> 的默认插槽中，激活时会显示半透明遮罩并只高亮该元素。
        勾选「不再提示」后会被记住，刷新页面依然生效。
      </p>
    </header>

    <div class="demo__toolbar">
      <button
        class="demo__btn demo__btn--primary"
        @click="onboarding.start()"
      >
        开始「新手引导」
      </button>
      <button
        class="demo__btn"
        @click="analytics.start()"
      >
        开始「数据面板引导」
      </button>
      <button
        class="demo__btn"
        @click="placementGuide.start()"
      >
        开始「方位演示」
      </button>
      <button
        class="demo__btn"
        @click="resetAll"
      >
        重置「不再提示」
      </button>
    </div>

    <p class="demo__dismissed">
      {{ dismissedSummary }}
    </p>

    <!-- 指引组一：新手引导。Provider 声明组级「不再提示」能力，此处使用默认开启。 -->
    <GuideProvider id="onboarding">
      <section class="demo__grid">
        <KProGuide
          id="onboarding"
          :serial="1"
          title="第一步 · 新建项目"
          content="这里是新建入口，点击即可创建一个新项目。"
          @step-change="(payload) => log(`onboarding 步骤切换 ${describe(payload)}`)"
          @finish="log('onboarding 引导完成')"
          @close="log('onboarding 引导关闭')"
          @dont-show-again="log('onboarding 已设置为不再提示')"
        >
          <div class="demo__card">
            <div class="demo__stat">
              128
            </div>
            <h3>项目总数</h3>
            <p>当前工作区内的项目数量。</p>
            <button class="demo__btn demo__btn--primary">
              新建项目
            </button>
          </div>
        </KProGuide>

        <KProGuide
          id="onboarding"
          :serial="2"
          title="第二步 · 邀请成员"
          content="把团队成员加入项目，协作从这里开始。"
        >
          <div class="demo__card">
            <div class="demo__stat">
              12
            </div>
            <h3>团队成员</h3>
            <p>点击可邀请新的成员加入协作。</p>
            <button class="demo__btn">
              邀请成员
            </button>
          </div>
        </KProGuide>

        <KProGuide
          id="onboarding"
          :serial="3"
          title="第三步 · 发布上线"
          content="确认无误后即可把项目发布出去。"
        >
          <div class="demo__card">
            <div class="demo__stat">
              3
            </div>
            <h3>待发布</h3>
            <p>发布后线上环境会立即生效。</p>
            <button class="demo__btn">
              立即发布
            </button>
          </div>
        </KProGuide>
      </section>
    </GuideProvider>

    <!-- 指引组二：数据面板。与指引组一相互独立，可同时激活。 -->
    <section
      class="demo__grid"
      style="margin-top: 16px"
    >
      <KProGuide
        id="analytics"
        :serial="1"
        title="访问量"
        content="统计近 7 天的页面访问量，点击可查看明细。"
        :padding="10"
        @finish="log('analytics 引导完成')"
      >
        <div class="demo__card">
          <div class="demo__stat">
            9,842
          </div>
          <h3>近 7 天访问量</h3>
          <p>较上周增长 12.4%。</p>
          <button class="demo__btn">
            查看明细
          </button>
        </div>
      </KProGuide>

      <KProGuide
        id="analytics"
        :serial="2"
        title="导出报表"
        content="支持导出 CSV，方便做二次分析。"
        :padding="10"
      >
        <div class="demo__card">
          <div class="demo__stat">
            CSV
          </div>
          <h3>导出报表</h3>
          <p>一键导出当前筛选条件下的数据。</p>
          <button class="demo__btn">
            导出
          </button>
        </div>
      </KProGuide>
    </section>

    <!-- 指引组三：四种浮层方位。 -->
    <h3 style="margin: 28px 0 0; font-size: 15px">
      浮层方位
    </h3>
    <p class="demo__hint">
      分别指定 placement 为 top / right / bottom / left，验证定位与视口边界收敛。
    </p>
    <div class="demo__placement-bar">
      <KProGuide
        v-for="item in placementButtons"
        id="placement"
        :key="item.serial"
        :serial="item.serial"
        :placement="item.placement"
        :title="`${item.label}定位`"
        :content="`当前浮层显示在目标元素的${item.label}。`"
      >
        <button class="demo__btn">
          {{ item.label }}定位
        </button>
      </KProGuide>
    </div>

    <h3 style="margin: 24px 0 8px; font-size: 15px">
      事件日志
    </h3>
    <div class="demo__log">
      <template v-if="logs.length">
        <div
          v-for="(item, index) in logs"
          :key="index"
        >
          {{ item }}
        </div>
      </template>
      <span v-else>暂无事件，点击上方按钮开始引导。</span>
    </div>
    <p class="demo__hint">
      「不再提示」默认写入 localStorage 的 <code>kpro:guide:dismissed</code>，可通过
      <code>configureGuide</code> 更换存储键或接入服务端。
    </p>
  </div>
</template>
