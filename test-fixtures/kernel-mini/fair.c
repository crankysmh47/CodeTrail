#include "sched.h"

static int entity_eligible(const struct sched_entity *se)
{
    return se->vruntime <= se->deadline;
}

static struct task_struct *pick_eevdf(struct rq *rq)
{
    if (rq->current && entity_eligible(&rq->current->se))
        return rq->current;
    return 0;
}

static struct task_struct *pick_next_task_fair(struct rq *rq)
{
    return pick_eevdf(rq);
}

DEFINE_SCHED_CLASS(fair) = {
    .pick_task = pick_next_task_fair,
};

static struct task_struct *pick_task(struct rq *rq, const struct sched_class *class)
{
    return class->pick_task(rq);
}

#ifdef CONFIG_SMP
static void update_load_balance(struct rq *rq)
{
    entity_eligible(&rq->current->se);
    rq->current->se.vruntime = rq->current->se.deadline;
}
#endif
